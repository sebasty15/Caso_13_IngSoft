USE marina_inteligencia;

SELECT DATABASE() AS base_actual, VERSION() AS version_servidor, @@port AS puerto;

SHOW TABLES;

SELECT id, nombre, estado, recompensa_vigente_monto, nivel_amenaza
FROM criminales
ORDER BY nombre;

SELECT id, criminal_id, fecha_hora, ubicacion
FROM avistamientos
ORDER BY fecha_hora DESC;

DESCRIBE avistamientos;
