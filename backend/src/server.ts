import express, { type Request, type Response } from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import type { ResultSetHeader, RowDataPacket } from "mysql2/promise";
import dotenv from "dotenv";
import { pool, testConnection } from "./db.js";
 
dotenv.config();
 
const app = express();
const PORT = Number(process.env.PORT || 3000);
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const allowedOrigins = new Set([
    FRONTEND_URL,
    "http://localhost:5173",
    "http://127.0.0.1:5173"
]);
 
// Acepta cualquier puerto en localhost / 127.0.0.1 (Vite puede cambiar de 5173 a 5174, etc.)
const localOrigin = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
 
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.has(origin) || localOrigin.test(origin)) {
            callback(null, true);
        } else {
            console.warn(`CORS bloqueó el origen: ${origin}`);
            callback(null, false);
        }
    }
}));
app.use(express.json({ limit: "1mb" }));
 
type AvistamientoInput = {
    criminal_id: string;
    fecha_hora: string;
    ubicacion: string;
};
 
type CriminalRow = RowDataPacket & {
    id: string;
    nombre: string;
};
 
function parseFechaHora(value: unknown): string | null {
    if (typeof value !== "string") return null;
 
    // Acepta datetime-local del navegador o fecha SQL con segundos.
    const match = value.trim().match(
        /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2}))?$/
    );
    if (!match) return null;
 
    const [, y, mo, d, h, mi, s = "00"] = match;
    const year = Number(y);
    const month = Number(mo);
    const day = Number(d);
    const hour = Number(h);
    const minute = Number(mi);
    const second = Number(s);
 
    const date = new Date(year, month - 1, day, hour, minute, second);
    if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day ||
        date.getHours() !== hour ||
        date.getMinutes() !== minute ||
        date.getSeconds() !== second
    ) {
        return null;
    }
 
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}
 
function validateInput(body: unknown):
    | { ok: true; value: AvistamientoInput & { fecha_hora_sql: string } }
    | { ok: false; message: string } {
    if (!body || typeof body !== "object") {
        return { ok: false, message: "El cuerpo de la solicitud debe ser un objeto JSON." };
    }
 
    const data = body as Record<string, unknown>;
    if (typeof data.criminal_id !== "string" || !data.criminal_id.trim()) {
        return { ok: false, message: "criminal_id es obligatorio." };
    }
    if (typeof data.ubicacion !== "string" || !data.ubicacion.trim()) {
        return { ok: false, message: "ubicacion es obligatoria." };
    }
    if (data.ubicacion.trim().length > 2000) {
        return { ok: false, message: "La ubicación no puede superar 2000 caracteres." };
    }
 
    const fechaHora = parseFechaHora(data.fecha_hora);
    if (!fechaHora) {
        return {
            ok: false,
            message: "fecha_hora es obligatoria y debe tener formato YYYY-MM-DDTHH:mm."
        };
    }
 
    return {
        ok: true,
        value: {
            criminal_id: data.criminal_id.trim(),
            fecha_hora: typeof data.fecha_hora === "string" ? data.fecha_hora.trim() : "",
            fecha_hora_sql: fechaHora,
            ubicacion: data.ubicacion.trim()
        }
    };
}
 
async function criminalExiste(criminalId: string): Promise<boolean> {
    const [rows] = await pool.execute<RowDataPacket[]>(
        "SELECT id FROM criminales WHERE id = ? LIMIT 1",
        [criminalId]
    );
    return rows.length > 0;
}
 
app.get("/api/health", (_req: Request, res: Response) => {
    res.json({
        estado: "funcionando",
        mensaje: "API de avistamientos de la Marina operativa"
    });
});
 
app.get("/api/db-health", async (_req: Request, res: Response) => {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            "SELECT DATABASE() AS base_actual, VERSION() AS version_servidor"
        );
        res.json({
            estado: "conectado",
            mensaje: "Conexión con la base de datos exitosa",
            datos: rows
        });
    } catch (error) {
        console.error("Error al comprobar MySQL:", error);
        const e = error as { code?: string; sqlMessage?: string; message?: string };
        res.status(500).json({
            estado: "error",
            mensaje: "No se pudo conectar con la base de datos.",
            codigo: e.code,
            detalle: e.sqlMessage ?? e.message
        });
    }
});
 
app.get("/api/criminales", async (_req: Request, res: Response) => {
    try {
        const [rows] = await pool.query<CriminalRow[]>(
            `SELECT id, nombre, estado
             FROM criminales
             ORDER BY nombre ASC`
        );
        res.json(rows);
    } catch (error) {
        console.error("Error al consultar criminales:", error);
        res.status(500).json({ mensaje: "No se pudieron consultar los criminales." });
    }
});
 
app.get("/api/avistamientos", async (_req: Request, res: Response) => {
    try {
        const [rows] = await pool.query<RowDataPacket[]>(
            `SELECT
                a.id,
                a.criminal_id,
                c.nombre AS criminal_nombre,
                DATE_FORMAT(a.fecha_hora, '%Y-%m-%dT%H:%i') AS fecha_hora,
                a.ubicacion
             FROM avistamientos a
             INNER JOIN criminales c ON c.id = a.criminal_id
             ORDER BY a.fecha_hora DESC`
        );
        res.json(rows);
    } catch (error) {
        console.error("Error al consultar avistamientos:", error);
        res.status(500).json({ mensaje: "No se pudieron consultar los avistamientos." });
    }
});
 
app.post("/api/avistamientos", async (req: Request, res: Response) => {
    const validation = validateInput(req.body);
    if (!validation.ok) {
        res.status(400).json({ mensaje: validation.message });
        return;
    }
 
    try {
        const { criminal_id, fecha_hora_sql, ubicacion } = validation.value;
        if (!(await criminalExiste(criminal_id))) {
            res.status(404).json({ mensaje: "No existe un criminal con ese identificador." });
            return;
        }
 
        const id = randomUUID();
        await pool.execute<ResultSetHeader>(
            `INSERT INTO avistamientos (id, criminal_id, fecha_hora, ubicacion)
             VALUES (?, ?, ?, ?)`,
            [id, criminal_id, fecha_hora_sql, ubicacion]
        );
 
        res.status(201).json({
            mensaje: "Avistamiento registrado correctamente.",
            avistamiento: { id, criminal_id, fecha_hora: validation.value.fecha_hora, ubicacion }
        });
    } catch (error) {
        console.error("Error al registrar avistamiento:", error);
        res.status(500).json({ mensaje: "No se pudo registrar el avistamiento." });
    }
});
 
app.put("/api/avistamientos/:id", async (req: Request, res: Response) => {
    const id = req.params.id;
    if (typeof id !== "string" || !id.trim()) {
        res.status(400).json({ mensaje: "El identificador del avistamiento es obligatorio." });
        return;
    }
 
    const validation = validateInput(req.body);
    if (!validation.ok) {
        res.status(400).json({ mensaje: validation.message });
        return;
    }
 
    try {
        const { criminal_id, fecha_hora_sql, ubicacion } = validation.value;
        if (!(await criminalExiste(criminal_id))) {
            res.status(404).json({ mensaje: "No existe un criminal con ese identificador." });
            return;
        }
 
        const [result] = await pool.execute<ResultSetHeader>(
            `UPDATE avistamientos
             SET criminal_id = ?, fecha_hora = ?, ubicacion = ?
             WHERE id = ?`,
            [criminal_id, fecha_hora_sql, ubicacion, id]
        );
 
        if (result.affectedRows === 0) {
            res.status(404).json({ mensaje: "No existe un avistamiento con ese identificador." });
            return;
        }
 
        res.json({
            mensaje: "Avistamiento actualizado correctamente.",
            avistamiento: { id, criminal_id, fecha_hora: validation.value.fecha_hora, ubicacion }
        });
    } catch (error) {
        console.error("Error al actualizar avistamiento:", error);
        res.status(500).json({ mensaje: "No se pudo actualizar el avistamiento." });
    }
});
 
app.delete("/api/avistamientos/:id", async (req: Request, res: Response) => {
    const id = req.params.id;
    if (typeof id !== "string" || !id.trim()) {
        res.status(400).json({ mensaje: "El identificador del avistamiento es obligatorio." });
        return;
    }
 
    try {
        const [result] = await pool.execute<ResultSetHeader>(
            "DELETE FROM avistamientos WHERE id = ?",
            [id]
        );
 
        if (result.affectedRows === 0) {
            res.status(404).json({ mensaje: "No existe un avistamiento con ese identificador." });
            return;
        }
 
        res.json({ mensaje: "Avistamiento eliminado correctamente." });
    } catch (error) {
        console.error("Error al eliminar avistamiento:", error);
        res.status(500).json({ mensaje: "No se pudo eliminar el avistamiento." });
    }
});
 
app.use((_req: Request, res: Response) => {
    res.status(404).json({ mensaje: "Ruta no encontrada." });
});
 
app.listen(PORT, () => {
    console.log(`Backend ejecutándose en http://localhost:${PORT}`);
    void testConnection();
});
 
