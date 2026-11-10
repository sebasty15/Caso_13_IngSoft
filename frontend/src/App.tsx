import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

const API_URL = ((import.meta as ImportMeta & { env?: { VITE_API_URL?: string } }).env?.VITE_API_URL || "http://localhost:3000").replace(/\/$/, "");

type Criminal = {
    id: string;
    nombre: string;
    estado: "ACTIVO" | "CAPTURADO" | "MUERTO";
};

type Avistamiento = {
    id: string;
    criminal_id: string;
    criminal_nombre: string;
    fecha_hora: string;
    ubicacion: string;
};

type FormState = {
    criminal_id: string;
    fecha_hora: string;
    ubicacion: string;
};

const emptyForm: FormState = {
    criminal_id: "",
    fecha_hora: "",
    ubicacion: ""
};

function localDateTimeValue() {
    const now = new Date();
    const offset = now.getTimezoneOffset();
    return new Date(now.getTime() - offset * 60_000).toISOString().slice(0, 16);
}

function formatDate(value: string) {
    if (!value) return "Sin fecha";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value.replace("T", " ");
    return new Intl.DateTimeFormat("es-CO", {
        dateStyle: "medium",
        timeStyle: "short"
    }).format(date);
}

async function readError(response: Response) {
    try {
        const body = await response.json();
        return body.mensaje || body.message || `Error HTTP ${response.status}`;
    } catch {
        return `Error HTTP ${response.status}`;
    }
}

export default function App() {
    const [criminales, setCriminales] = useState<Criminal[]>([]);
    const [avistamientos, setAvistamientos] = useState<Avistamiento[]>([]);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [dbStatus, setDbStatus] = useState<"checking" | "connected" | "error">("checking");
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const loadData = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const [criminalResponse, sightingsResponse, healthResponse] = await Promise.all([
                fetch(`${API_URL}/api/criminales`),
                fetch(`${API_URL}/api/avistamientos`),
                fetch(`${API_URL}/api/db-health`)
            ]);

            if (!criminalResponse.ok) throw new Error(await readError(criminalResponse));
            if (!sightingsResponse.ok) throw new Error(await readError(sightingsResponse));

            const criminalData: Criminal[] = await criminalResponse.json();
            const sightingsData: Avistamiento[] = await sightingsResponse.json();

            setCriminales(criminalData);
            setAvistamientos(sightingsData);
            setDbStatus(healthResponse.ok ? "connected" : "error");

            setForm((current) => ({
                ...current,
                criminal_id: current.criminal_id || criminalData[0]?.id || "",
                fecha_hora: current.fecha_hora || localDateTimeValue()
            }));
        } catch (err) {
            setDbStatus("error");
            setError(err instanceof Error
                ? `${err.message}. Comprueba que el backend esté ejecutándose y que la base de datos esté conectada.`
                : "No se pudieron cargar los datos.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const filteredSightings = useMemo(() => {
        const query = search.trim().toLocaleLowerCase("es");
        if (!query) return avistamientos;
        return avistamientos.filter((item) =>
            item.criminal_nombre.toLocaleLowerCase("es").includes(query) ||
            item.ubicacion.toLocaleLowerCase("es").includes(query)
        );
    }, [avistamientos, search]);

    const activeCriminals = criminales.filter((criminal) => criminal.estado === "ACTIVO").length;

    function changeField(field: keyof FormState, value: string) {
        setForm((current) => ({ ...current, [field]: value }));
        setError("");
        setSuccess("");
    }

    function resetForm(clearSuccess = true) {
        setEditingId(null);
        setForm({
            criminal_id: criminales[0]?.id || "",
            fecha_hora: localDateTimeValue(),
            ubicacion: ""
        });
        setError("");
        if (clearSuccess) setSuccess("");
    }

    async function submitForm(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setError("");
        setSuccess("");

        if (!form.criminal_id || !form.fecha_hora || !form.ubicacion.trim()) {
            setError("Completa todos los campos antes de guardar.");
            return;
        }

        setSaving(true);
        try {
            const response = await fetch(
                editingId
                    ? `${API_URL}/api/avistamientos/${encodeURIComponent(editingId)}`
                    : `${API_URL}/api/avistamientos`,
                {
                    method: editingId ? "PUT" : "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        criminal_id: form.criminal_id,
                        fecha_hora: form.fecha_hora,
                        ubicacion: form.ubicacion.trim()
                    })
                }
            );

            if (!response.ok) throw new Error(await readError(response));

            setSuccess(editingId
                ? "El avistamiento se actualizó correctamente."
                : "El avistamiento se registró correctamente.");
            resetForm(false);
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo guardar el avistamiento.");
        } finally {
            setSaving(false);
        }
    }

    function startEditing(item: Avistamiento) {
        setEditingId(item.id);
        setForm({
            criminal_id: item.criminal_id,
            fecha_hora: item.fecha_hora,
            ubicacion: item.ubicacion
        });
        setError("");
        setSuccess("");
        document.getElementById("formulario-avistamiento")?.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    }

    async function deleteSightings(item: Avistamiento) {
        const accepted = window.confirm(
            `¿Eliminar el avistamiento de ${item.criminal_nombre} en "${item.ubicacion}"? Esta acción no se puede deshacer.`
        );
        if (!accepted) return;

        setError("");
        setSuccess("");
        try {
            const response = await fetch(`${API_URL}/api/avistamientos/${encodeURIComponent(item.id)}`, {
                method: "DELETE"
            });
            if (!response.ok) throw new Error(await readError(response));
            setSuccess("El avistamiento se eliminó correctamente.");
            if (editingId === item.id) resetForm(false);
            await loadData();
        } catch (err) {
            setError(err instanceof Error ? err.message : "No se pudo eliminar el avistamiento.");
        }
    }

    return (
        <main className="app-shell">
            <header className="topbar">
                <a className="brand" href="#" aria-label="Inicio Marina">
                    <span className="brand-mark">M</span>
                    <span>
                        <strong>MARINA</strong>
                        <small>INTELIGENCIA · GRAND LINE</small>
                    </span>
                </a>
                <div className={`connection ${dbStatus}`}>
                    <span className="connection-dot" />
                    {dbStatus === "connected" ? "Base de datos conectada"
                        : dbStatus === "checking" ? "Comprobando conexión"
                        : "Sin conexión"}
                </div>
            </header>

            <section className="hero">
                <div className="hero-copy">
                    <div className="eyebrow"><span /> CENTRO DE INTELIGENCIA NAVAL</div>
                    <h1>Registro de <em>avistamientos</em></h1>
                    <p>Centraliza los reportes de presencia criminal y mantén la información operativa organizada y actualizada.</p>
                </div>
                <div className="hero-emblem" aria-hidden="true">
                    <div className="emblem-ring"><span>海軍</span><b>⚓</b></div>
                </div>
            </section>

            <section className="stats-grid" aria-label="Resumen">
                <article className="stat-card">
                    <span className="stat-icon navy">◎</span>
                    <div><span className="stat-label">AVISTAMIENTOS</span><strong>{avistamientos.length}</strong><small>Registros almacenados</small></div>
                </article>
                <article className="stat-card">
                    <span className="stat-icon gold">♙</span>
                    <div><span className="stat-label">CRIMINALES</span><strong>{criminales.length}</strong><small>En el catálogo</small></div>
                </article>
                <article className="stat-card">
                    <span className="stat-icon green">✓</span>
                    <div><span className="stat-label">ACTIVOS</span><strong>{activeCriminals}</strong><small>Con estado activo</small></div>
                </article>
            </section>

            {(error || success) && (
                <div className={`notice ${error ? "notice-error" : "notice-success"}`} role="status">
                    <span>{error ? "!" : "✓"}</span>
                    <p>{error || success}</p>
                    <button className="notice-close" onClick={() => { setError(""); setSuccess(""); }} aria-label="Cerrar aviso">×</button>
                </div>
            )}

            <section className="workspace">
                <aside className="panel form-panel" id="formulario-avistamiento">
                    <div className="panel-heading">
                        <div>
                            <span className="section-kicker">{editingId ? "ACTUALIZACIÓN" : "NUEVO REGISTRO"}</span>
                            <h2>{editingId ? "Editar avistamiento" : "Registrar avistamiento"}</h2>
                        </div>
                        <span className="heading-symbol">{editingId ? "✎" : "+"}</span>
                    </div>
                    <p className="panel-description">Ingresa los datos del incidente para incorporarlo al archivo naval.</p>

                    <form onSubmit={submitForm} className="sighting-form">
                        <label htmlFor="criminal">Criminal relacionado <span>*</span></label>
                        <select
                            id="criminal"
                            value={form.criminal_id}
                            onChange={(event) => changeField("criminal_id", event.target.value)}
                            required
                            disabled={loading || criminales.length === 0}
                        >
                            {criminales.length === 0 && <option value="">No hay criminales disponibles</option>}
                            {criminales.map((criminal) => (
                                <option key={criminal.id} value={criminal.id}>
                                    {criminal.nombre} · {criminal.estado}
                                </option>
                            ))}
                        </select>

                        <label htmlFor="fecha">Fecha y hora <span>*</span></label>
                        <input
                            id="fecha"
                            type="datetime-local"
                            value={form.fecha_hora}
                            onChange={(event) => changeField("fecha_hora", event.target.value)}
                            required
                        />

                        <label htmlFor="ubicacion">Ubicación del avistamiento <span>*</span></label>
                        <textarea
                            id="ubicacion"
                            value={form.ubicacion}
                            onChange={(event) => changeField("ubicacion", event.target.value)}
                            placeholder="Ej. Archipiélago Sabaody, muelle norte..."
                            rows={3}
                            maxLength={2000}
                            required
                        />
                        <div className="field-hint">Describe la isla, zona, puerto o referencia geográfica.</div>

                        <div className="form-actions">
                            <button className="primary-button" type="submit" disabled={saving || loading || criminales.length === 0}>
                                {saving ? "Guardando..." : editingId ? "Guardar cambios" : "Registrar avistamiento"}
                            </button>
                            {editingId && <button className="secondary-button" type="button" onClick={() => resetForm()}>Cancelar edición</button>}
                        </div>
                    </form>
                    <div className="form-footnote"><span>◆</span> Los campos marcados con * son obligatorios.</div>
                </aside>

                <section className="panel records-panel">
                    <div className="records-heading">
                        <div>
                            <span className="section-kicker">ARCHIVO OPERATIVO</span>
                            <h2>Avistamientos registrados</h2>
                            <p>Consulta y administra los reportes existentes.</p>
                        </div>
                        <button className="refresh-button" onClick={() => void loadData()} disabled={loading} title="Actualizar lista">
                            <span className={loading ? "spinning" : ""}>↻</span> Actualizar
                        </button>
                    </div>

                    <div className="search-wrap">
                        <span aria-hidden="true">⌕</span>
                        <input
                            type="search"
                            placeholder="Buscar por criminal o ubicación..."
                            value={search}
                            onChange={(event) => setSearch(event.target.value)}
                            aria-label="Buscar avistamientos"
                        />
                        {search && <button onClick={() => setSearch("")} aria-label="Limpiar búsqueda">×</button>}
                    </div>

                    <div className="table-meta">
                        <span>{search ? `${filteredSightings.length} resultado(s)` : `${avistamientos.length} registro(s)`}</span>
                        <span className="live-label"><span /> DATOS EN VIVO</span>
                    </div>

                    {loading ? (
                        <div className="empty-state"><div className="loader" /><strong>Cargando archivo...</strong><p>Consultando los registros de la Marina.</p></div>
                    ) : filteredSightings.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">⌁</div>
                            <strong>{search ? "No hay coincidencias" : "Todavía no hay avistamientos"}</strong>
                            <p>{search ? "Prueba con otro nombre o ubicación." : "Cuando registres el primer avistamiento, aparecerá aquí."}</p>
                            {search && <button className="text-button" onClick={() => setSearch("")}>Limpiar búsqueda</button>}
                        </div>
                    ) : (
                        <div className="sightings-list">
                            {filteredSightings.map((item, index) => (
                                <article className="sighting-row" key={item.id}>
                                    <div className="record-index">{String(index + 1).padStart(2, "0")}</div>
                                    <div className="record-main">
                                        <div className="record-title-line">
                                            <h3>{item.criminal_nombre}</h3>
                                            <span className="record-badge">REGISTRADO</span>
                                        </div>
                                        <p className="record-location"><span>⌖</span> {item.ubicacion}</p>
                                        <p className="record-date"><span>◷</span> {formatDate(item.fecha_hora)}</p>
                                    </div>
                                    <div className="record-actions">
                                        <button className="icon-button edit-button" onClick={() => startEditing(item)} aria-label={`Editar avistamiento de ${item.criminal_nombre}`} title="Editar">✎</button>
                                        <button className="icon-button delete-button" onClick={() => void deleteSightings(item)} aria-label={`Eliminar avistamiento de ${item.criminal_nombre}`} title="Eliminar">×</button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                    <footer className="records-footer">
                        <span>MARINA · SISTEMA DE INTELIGENCIA</span>
                        <span>GESTIÓN DE AVISTAMIENTOS</span>
                    </footer>
                </section>
            </section>

            <footer className="page-footer">
                <span>MARINA INTELLIGENCE SYSTEM <b>•</b> GRAND LINE</span>
                <span>Interfaz de gestión interna · Versión 1.0</span>
            </footer>
        </main>
    );
}
