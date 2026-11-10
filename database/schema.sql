-- ADVERTENCIA: Este script elimina y recrea las tablas del esquema antes de sembrar datos.
-- No lo ejecutes sobre una base con datos que quieras conservar. Haz respaldo primero.

-- =====================================================================
--  Sistema de Gestión de Recompensas y Captura de Criminales de la Marina
--  Script completo con Historial, Triggers y Datos de Prueba de One Piece
-- =====================================================================

CREATE DATABASE IF NOT EXISTS marina_inteligencia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE marina_inteligencia;

SET FOREIGN_KEY_CHECKS = 0;

-- Limpieza previa de tablas
DROP TABLE IF EXISTS avistamientos;
DROP TABLE IF EXISTS reportes_ciudadanos;
DROP TABLE IF EXISTS criterios_amenaza;
DROP TABLE IF EXISTS carteles;
DROP TABLE IF EXISTS criminales_historial;
DROP TABLE IF EXISTS antecedentes;
DROP TABLE IF EXISTS recompensas;
DROP TABLE IF EXISTS membresias;
DROP TABLE IF EXISTS organizaciones;
DROP TABLE IF EXISTS criminales;
DROP TABLE IF EXISTS usuarios;
DROP TABLE IF EXISTS bases_navales;
DROP TABLE IF EXISTS zonas_influencia;
DROP TABLE IF EXISTS mares;
DROP TABLE IF EXISTS roles;

SET FOREIGN_KEY_CHECKS = 1;

-- ---------------------------------------------------------------------
-- 1. DEFINICIÓN DE TABLAS PRINCIPALES
-- ---------------------------------------------------------------------

CREATE TABLE roles (
    id VARCHAR(36) PRIMARY KEY,
    codigo VARCHAR(50) UNIQUE NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    permisos JSON NOT NULL,
    requiere_2fa TINYINT(1) NOT NULL DEFAULT 0,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE mares (
    id VARCHAR(36) PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    tipo ENUM('CUATRO_MARES', 'GRAND_LINE') NOT NULL,
    activo TINYINT(1) NOT NULL DEFAULT 1
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE zonas_influencia (
    id VARCHAR(36) PRIMARY KEY,
    mar_id VARCHAR(36) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT,
    activo TINYINT(1) NOT NULL DEFAULT 1,
    CONSTRAINT uq_zonas_mar_nombre UNIQUE (mar_id, nombre),
    CONSTRAINT fk_zonas_mar FOREIGN KEY (mar_id) REFERENCES mares(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX ix_zonas_influencia_mar_id ON zonas_influencia(mar_id);

CREATE TABLE bases_navales (
    id VARCHAR(36) PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    zona_influencia_id VARCHAR(36) NOT NULL,
    ubicacion TEXT NOT NULL,
    comandante_nombre VARCHAR(150) NOT NULL,
    estado ENUM('ACTIVA', 'INACTIVA') NOT NULL DEFAULT 'ACTIVA',
    version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_bases_zona FOREIGN KEY (zona_influencia_id) REFERENCES zonas_influencia(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX ix_bases_navales_zona_influencia_id ON bases_navales(zona_influencia_id);

CREATE TABLE usuarios (
    id VARCHAR(36) PRIMARY KEY,
    nombre_completo VARCHAR(150) NOT NULL,
    email VARCHAR(150) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    rol_id VARCHAR(36) NOT NULL,
    base_naval_id VARCHAR(36) NULL,
    estado ENUM('ACTIVO', 'BLOQUEADO', 'INACTIVO') NOT NULL DEFAULT 'ACTIVO',
    mfa_habilitado TINYINT(1) NOT NULL DEFAULT 0,
    mfa_secreto_cifrado TEXT,
    intentos_fallidos INT NOT NULL DEFAULT 0 CHECK (intentos_fallidos >= 0),
    ultimo_acceso TIMESTAMP NULL,
    version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_usuarios_rol FOREIGN KEY (rol_id) REFERENCES roles(id) ON DELETE RESTRICT,
    CONSTRAINT fk_usuarios_base FOREIGN KEY (base_naval_id) REFERENCES bases_navales(id) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX ix_usuarios_rol_id ON usuarios(rol_id);
CREATE INDEX ix_usuarios_base_naval_id ON usuarios(base_naval_id);

CREATE TABLE criminales (
    id VARCHAR(36) PRIMARY KEY,
    nombre VARCHAR(150) NOT NULL,
    nombre_normalizado VARCHAR(150) UNIQUE NOT NULL,
    alias JSON,
    edad INT CHECK (edad >= 0),
    descripcion_fisica TEXT,
    foto JSON,
    estado ENUM('ACTIVO', 'CAPTURADO', 'MUERTO') NOT NULL DEFAULT 'ACTIVO',
    fecha_baja TIMESTAMP NULL,
    zona_influencia_id VARCHAR(36) NULL,
    recompensa_vigente_monto NUMERIC(15, 2) CHECK (recompensa_vigente_monto >= 0),
    nivel_amenaza ENUM('BAJO', 'MEDIO', 'ALTO', 'PENDIENTE') NOT NULL DEFAULT 'PENDIENTE',
    origen_base_id VARCHAR(36) NULL,
    creado_por VARCHAR(36) NULL,
    actualizado_por VARCHAR(36) NULL,
    version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_criminales_zona FOREIGN KEY (zona_influencia_id) REFERENCES zonas_influencia(id) ON DELETE SET NULL,
    CONSTRAINT fk_criminales_base FOREIGN KEY (origen_base_id) REFERENCES bases_navales(id) ON DELETE SET NULL,
    CONSTRAINT fk_criminales_creado FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_criminales_actualizado FOREIGN KEY (actualizado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE INDEX ix_criminales_estado_nivel ON criminales(estado, nivel_amenaza);
CREATE INDEX ix_criminales_zona_estado ON criminales(zona_influencia_id, estado);
CREATE INDEX ix_criminales_recompensa ON criminales(recompensa_vigente_monto DESC);

-- TABLA DE HISTORIAL AUTOMÁTICO PARA CRIMINALES
CREATE TABLE criminales_historial (
    id VARCHAR(36) PRIMARY KEY,
    criminal_id VARCHAR(36) NOT NULL,
    nombre_anterior VARCHAR(150),
    nombre_nuevo VARCHAR(150),
    estado_anterior VARCHAR(50),
    estado_nuevo VARCHAR(50),
    recompensa_anterior NUMERIC(15, 2),
    recompensa_nueva NUMERIC(15, 2),
    modificado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_historial_criminal FOREIGN KEY (criminal_id) REFERENCES criminales(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE organizaciones (
    id VARCHAR(36) PRIMARY KEY,
    nombre VARCHAR(100) UNIQUE NOT NULL,
    tipo_agrupacion ENUM('TRIPULACION', 'ORGANIZACION', 'BANDA') NOT NULL,
    categoria ENUM('PIRATA', 'REVOLUCIONARIO', 'CRIMINAL_INDEPENDIENTE') NOT NULL,
    zona_influencia_id VARCHAR(36) NULL,
    descripcion TEXT,
    activa TINYINT(1) NOT NULL DEFAULT 1,
    version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_organizaciones_zona FOREIGN KEY (zona_influencia_id) REFERENCES zonas_influencia(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE membresias (
    id VARCHAR(36) PRIMARY KEY,
    criminal_id VARCHAR(36) NOT NULL,
    organizacion_id VARCHAR(36) NOT NULL,
    rol ENUM('LIDER', 'OFICIAL', 'MIEMBRO') NOT NULL,
    vigente TINYINT(1) NOT NULL DEFAULT 1,
    fecha_ingreso TIMESTAMP NULL,
    fecha_salida TIMESTAMP NULL,
    creado_por VARCHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_membresias_criminal FOREIGN KEY (criminal_id) REFERENCES criminales(id) ON DELETE CASCADE,
    CONSTRAINT fk_membresias_organizacion FOREIGN KEY (organizacion_id) REFERENCES organizaciones(id) ON DELETE CASCADE,
    CONSTRAINT fk_membresias_creado FOREIGN KEY (creado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE recompensas (
    id VARCHAR(36) PRIMARY KEY,
    criminal_id VARCHAR(36) NOT NULL,
    monto NUMERIC(15, 2) NOT NULL CHECK (monto >= 0),
    moneda VARCHAR(20) NOT NULL DEFAULT 'BERRIES',
    estado ENUM('PENDIENTE_VALIDACION', 'VIGENTE', 'HISTORICA', 'RECHAZADA') NOT NULL DEFAULT 'PENDIENTE_VALIDACION',
    requiere_validacion TINYINT(1) NOT NULL DEFAULT 0,
    solicitada_por VARCHAR(36) NULL,
    fecha_solicitud TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    validada_por VARCHAR(36) NULL,
    fecha_validacion TIMESTAMP NULL,
    vigente_desde TIMESTAMP NULL,
    vigente_hasta TIMESTAMP NULL,
    motivo TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_recompensas_criminal FOREIGN KEY (criminal_id) REFERENCES criminales(id) ON DELETE CASCADE,
    CONSTRAINT fk_recompensas_solicitada FOREIGN KEY (solicitada_por) REFERENCES usuarios(id) ON DELETE SET NULL,
    CONSTRAINT fk_recompensas_validada FOREIGN KEY (validada_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE antecedentes (
    id VARCHAR(36) PRIMARY KEY,
    criminal_id VARCHAR(36) NOT NULL,
    tipo_delito VARCHAR(100) NOT NULL,
    descripcion TEXT NOT NULL,
    fecha_hecho TIMESTAMP NULL,
    ubicacion TEXT,
    registrado_por VARCHAR(36) NULL,
    version BIGINT NOT NULL DEFAULT 1 CHECK (version >= 0),
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_antecedentes_criminal FOREIGN KEY (criminal_id) REFERENCES criminales(id) ON DELETE CASCADE,
    CONSTRAINT fk_antecedentes_registrado FOREIGN KEY (registrado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE carteles (
    id VARCHAR(36) PRIMARY KEY,
    criminal_id VARCHAR(36) NOT NULL,
    numero_version INT NOT NULL CHECK (numero_version >= 0),
    vigente TINYINT(1) NOT NULL DEFAULT 1,
    archivo JSON NOT NULL,
    datos_instantanea JSON NOT NULL,
    motivo_generacion ENUM('REGISTRO', 'CAMBIO_FOTO', 'CAMBIO_RECOMPENSA', 'CAMBIO_ESTADO', 'CAMBIO_AFILIACION', 'MANUAL') NOT NULL,
    generado_por VARCHAR(36) NULL,
    generado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_carteles_criminal FOREIGN KEY (criminal_id) REFERENCES criminales(id) ON DELETE CASCADE,
    CONSTRAINT fk_carteles_generado FOREIGN KEY (generado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE criterios_amenaza (
    id VARCHAR(36) PRIMARY KEY,
    nivel ENUM('BAJO', 'MEDIO', 'ALTO', 'PENDIENTE') NOT NULL,
    monto_minimo NUMERIC(15, 2) NOT NULL CHECK (monto_minimo >= 0),
    monto_maximo NUMERIC(15, 2) CHECK (monto_maximo >= 0),
    vigente TINYINT(1) NOT NULL DEFAULT 1,
    vigente_desde TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    vigente_hasta TIMESTAMP NULL,
    modificado_por VARCHAR(36) NULL,
    motivo TEXT,
    CONSTRAINT fk_criterios_modificado FOREIGN KEY (modificado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE reportes_ciudadanos (
    id VARCHAR(36) PRIMARY KEY,
    criminal_id VARCHAR(36) NOT NULL,
    descripcion TEXT NOT NULL,
    fecha_hecho TIMESTAMP NULL,
    ubicacion TEXT NOT NULL,
    informante JSON NOT NULL,
    estado ENUM('PENDIENTE', 'APROBADO', 'RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',
    revisado_por VARCHAR(36) NULL,
    fecha_revision TIMESTAMP NULL,
    motivo_rechazo TEXT,
    avistamiento_id VARCHAR(36) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_reportes_criminal FOREIGN KEY (criminal_id) REFERENCES criminales(id) ON DELETE CASCADE,
    CONSTRAINT fk_reportes_revisado FOREIGN KEY (revisado_por) REFERENCES usuarios(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE avistamientos (
    id VARCHAR(36) PRIMARY KEY,
    criminal_id VARCHAR(36) NOT NULL,
    fecha_hora TIMESTAMP NOT NULL,
    ubicacion TEXT NOT NULL,
    CONSTRAINT fk_avistamientos_criminal FOREIGN KEY (criminal_id) REFERENCES criminales(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- 2. TRIGGER PARA EL HISTORIAL AUTOMÁTICO
-- ---------------------------------------------------------------------
DELIMITER //

CREATE TRIGGER trg_criminales_historial_update
AFTER UPDATE ON criminales
FOR EACH ROW
BEGIN
    IF OLD.nombre <> NEW.nombre OR OLD.estado <> NEW.estado OR OLD.recompensa_vigente_monto <> NEW.recompensa_vigente_monto THEN
        INSERT INTO criminales_historial (
            id, criminal_id, nombre_anterior, nombre_nuevo, 
            estado_anterior, estado_nuevo, recompensa_anterior, recompensa_nueva, modificado_en
        ) VALUES (
            UUID(), NEW.id, OLD.nombre, NEW.nombre, 
            OLD.estado, NEW.estado, OLD.recompensa_vigente_monto, NEW.recompensa_vigente_monto, NOW()
        );
    END IF;
END;
//

DELIMITER ;

-- ---------------------------------------------------------------------
-- 3. DATOS DE PRUEBA (UNIVERSO DE ONE PIECE)
-- ---------------------------------------------------------------------

-- Roles de la Marina
INSERT INTO roles (id, codigo, nombre, descripcion, permisos, requiere_2fa, activo) VALUES 
('r-almirante', 'ALMIRANTE', 'Almirante de la Marina', 'Acceso total al sistema', '["ALL"]', 1, 1),
('r-capitan', 'CAPITAN', 'Capitán de Base', 'Gestión de zona y recompensas', '["GESTION_CRIMINALES"]', 1, 1);

-- Mares
INSERT INTO mares (id, nombre, tipo, activo) VALUES 
('m-east', 'East Blue', 'CUATRO_MARES', 1),
('m-grand', 'Grand Line', 'GRAND_LINE', 1);

-- Zonas de Influencia
INSERT INTO zonas_influencia (id, mar_id, nombre, descripcion, activo) VALUES 
('z-conoid', 'm-east', 'Archipiélago Conomi', 'Zona pacífica vigilada', 1),
('z-sabaody', 'm-grand', 'Archipiélago Sabaody', 'Zona cercana a Mary Geoise', 1);

-- Bases Navales
INSERT INTO bases_navales (id, nombre, zona_influencia_id, ubicacion, comandante_nombre, estado, version) VALUES 
('b-hq', 'Cuartel General de la Marina', 'z-sabaody', 'Marineford', 'Almirante de Flota Sakazuki (Akainu)', 'ACTIVA', 1),
('b-16', 'Base G-16', 'z-conoid', 'East Blue', 'Comandante Nezire', 'ACTIVA', 1);

-- Usuarios (Marines)
INSERT INTO usuarios (id, nombre_completo, email, password_hash, rol_id, base_naval_id, estado, mfa_habilitado, version) VALUES 
('u-sengoku', 'Sengoku el Budapasta', 'sengoku@marina.gov', '$2y$10$xyz...', 'r-almirante', 'b-hq', 'ACTIVO', 1, 1),
('u-smoker', 'Smoker el Cazador', 'smoker@marina.gov', '$2y$10$xyz...', 'r-capitan', 'b-16', 'ACTIVO', 1, 1);

-- Organizaciones (Tripulaciones Piratas)
INSERT INTO organizaciones (id, nombre, tipo_agrupacion, categoria, zona_influencia_id, descripcion, activa, version) VALUES 
('org-strawhat', 'Piratas de Sombrero de Paja', 'TRIPULACION', 'PIRATA', 'z-sabaody', 'Banda criminal extremadamente peligrosa', 1, 1);

-- Criminales (Personajes de One Piece)
INSERT INTO criminales (id, nombre, nombre_normalizado, alias, edad, descripcion_fisica, foto, estado, zona_influencia_id, recompensa_vigente_monto, nivel_amenaza, origen_base_id, creado_por, version) VALUES 
('c-luffy', 'Monkey D. Luffy', 'monkey d luffy', '["Sombrero de Paja", "Mugiwara", "Emperador del Mar"]', 19, 'Complexión delgada, cicatriz en el pecho y ojo izquierdo', '{"url": "img/luffy.png", "mime": "image/png", "tamano_bytes": 52000}', 'ACTIVO', 'z-sabaody', 3000000000.00, 'ALTO', 'b-hq', 'u-smoker', 1),
('c-zoro', 'Roronoa Zoro', 'roronoa zoro', '["Cazador de Piratas", "Zoro"]', 21, 'Cabello verde, tres katanas, musculoso', '{"url": "img/zoro.png", "mime": "image/png", "tamano_bytes": 48000}', 'ACTIVO', 'z-sabaody', 1111000000.00, 'ALTO', 'b-hq', 'u-smoker', 1);

-- Membresías
INSERT INTO membresias (id, criminal_id, organizacion_id, rol, vigente, fecha_ingreso, creado_por) VALUES 
('mb-luffy', 'c-luffy', 'org-strawhat', 'LIDER', 1, NOW(), 'u-smoker'),
('mb-zoro', 'c-zoro', 'org-strawhat', 'OFICIAL', 1, NOW(), 'u-smoker');

-- Recompensas iniciales
INSERT INTO recompensas (id, criminal_id, monto, moneda, estado, requiere_validacion, solicitada_por, vigente_desde, motivo) VALUES 
('rc-luffy', 'c-luffy', 3000000000.00, 'BERRIES', 'VIGENTE', 0, 'u-sengoku', NOW(), 'Aumento tras incidentes en el País de Wano'),
('rc-zoro', 'c-zoro', 1111000000.00, 'BERRIES', 'VIGENTE', 0, 'u-sengoku', NOW(), 'Aumento tras derrota de King en Wano');