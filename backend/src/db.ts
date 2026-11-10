import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const required = ["DB_HOST", "DB_PORT", "DB_USER", "DB_NAME"] as const;
for (const key of required) {
    if (!process.env[key]) {
        throw new Error(`Falta la variable obligatoria ${key} en backend/.env`);
    }
}

export const dbConfig = {
    host: process.env.DB_HOST!,
    port: Number(process.env.DB_PORT),
    user: process.env.DB_USER!,
    password: process.env.DB_PASSWORD ?? "",
    database: process.env.DB_NAME!
};

export const pool = mysql.createPool({
    ...dbConfig,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    connectTimeout: 10000,
    dateStrings: true
});

// Se llama al arrancar el backend para ver de inmediato si la BD responde
// y, si falla, mostrar el motivo real (código + mensaje) en la consola.
export async function testConnection(): Promise<void> {
    try {
        const conn = await pool.getConnection();
        const [rows] = await conn.query("SELECT DATABASE() AS bd, @@port AS puerto, VERSION() AS version");
        conn.release();
        console.log("✔ MySQL conectado:", (rows as unknown[])[0]);
    } catch (error) {
        const e = error as { code?: string; errno?: number; sqlMessage?: string; message?: string };
        console.error("✘ No se pudo conectar a MySQL");
        console.error(`   Intentó: ${dbConfig.user}@${dbConfig.host}:${dbConfig.port} / base "${dbConfig.database}"`);
        console.error(`   Código:  ${e.code ?? "desconocido"} (${e.errno ?? "-"})`);
        console.error(`   Mensaje: ${e.sqlMessage ?? e.message}`);
    }
}
