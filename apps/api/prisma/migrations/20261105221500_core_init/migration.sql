-- CreateTable
CREATE TABLE `institucion` (
    `id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(150) NOT NULL,
    `direccion` VARCHAR(200) NULL,
    `telefono` VARCHAR(30) NULL,
    `email` VARCHAR(150) NULL,
    `logo_url` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `persona` (
    `id` CHAR(36) NOT NULL,
    `nombres` VARCHAR(100) NOT NULL,
    `apellidos` VARCHAR(100) NOT NULL,
    `tipo_documento` VARCHAR(20) NOT NULL,
    `numero_documento` VARCHAR(30) NOT NULL,
    `fecha_nacimiento` DATE NULL,
    `telefono` VARCHAR(30) NULL,
    `email_contacto` VARCHAR(150) NULL,
    `direccion` VARCHAR(200) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `persona_documento_key`(`tipo_documento`, `numero_documento`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `usuario` (
    `id` CHAR(36) NOT NULL,
    `persona_id` CHAR(36) NOT NULL,
    `username` VARCHAR(60) NULL,
    `email` VARCHAR(150) NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `debe_cambiar_password` BOOLEAN NOT NULL DEFAULT true,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `ultimo_acceso` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `usuario_persona_id_key`(`persona_id`),
    UNIQUE INDEX `usuario_username_key`(`username`),
    UNIQUE INDEX `usuario_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `rol` (
    `id` CHAR(36) NOT NULL,
    `codigo` VARCHAR(30) NOT NULL,
    `nombre` VARCHAR(60) NOT NULL,
    `descripcion` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,

    UNIQUE INDEX `rol_codigo_key`(`codigo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `usuario_rol` (
    `usuario_id` CHAR(36) NOT NULL,
    `rol_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` CHAR(36) NULL,

    PRIMARY KEY (`usuario_id`, `rol_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `sesion_refresh` (
    `id` CHAR(36) NOT NULL,
    `usuario_id` CHAR(36) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expira_en` DATETIME(3) NOT NULL,
    `revocado_en` DATETIME(3) NULL,
    `ip` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sesion_refresh_token_hash_key`(`token_hash`),
    INDEX `sesion_refresh_usuario_id_idx`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `token_recuperacion` (
    `id` CHAR(36) NOT NULL,
    `usuario_id` CHAR(36) NOT NULL,
    `token_hash` VARCHAR(255) NOT NULL,
    `expira_en` DATETIME(3) NOT NULL,
    `usado_en` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `token_recuperacion_token_hash_key`(`token_hash`),
    INDEX `token_recuperacion_usuario_id_idx`(`usuario_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `anio_academico` (
    `id` CHAR(36) NOT NULL,
    `institucion_id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(20) NOT NULL,
    `fecha_inicio` DATE NOT NULL,
    `fecha_fin` DATE NOT NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'PLANIFICADO',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `anio_academico_institucion_id_estado_idx`(`institucion_id`, `estado`),
    UNIQUE INDEX `anio_academico_nombre_key`(`institucion_id`, `nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `periodo_academico` (
    `id` CHAR(36) NOT NULL,
    `anio_id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(50) NOT NULL,
    `orden` INTEGER NOT NULL,
    `fecha_inicio` DATE NOT NULL,
    `fecha_fin` DATE NOT NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'PLANIFICADO',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,

    UNIQUE INDEX `periodo_academico_orden_key`(`anio_id`, `orden`),
    UNIQUE INDEX `periodo_academico_nombre_key`(`anio_id`, `nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `nivel` (
    `id` CHAR(36) NOT NULL,
    `institucion_id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(50) NOT NULL,
    `orden` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `nivel_nombre_key`(`institucion_id`, `nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `grado` (
    `id` CHAR(36) NOT NULL,
    `nivel_id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(50) NOT NULL,
    `orden` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `grado_orden_key`(`nivel_id`, `orden`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `seccion` (
    `id` CHAR(36) NOT NULL,
    `grado_id` CHAR(36) NOT NULL,
    `anio_id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(20) NOT NULL,
    `capacidad` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `seccion_anio_id_idx`(`anio_id`),
    UNIQUE INDEX `seccion_nombre_key`(`grado_id`, `anio_id`, `nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `curso` (
    `id` CHAR(36) NOT NULL,
    `nivel_id` CHAR(36) NOT NULL,
    `nombre` VARCHAR(100) NOT NULL,
    `area` VARCHAR(100) NULL,
    `orden` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `curso_nombre_key`(`nivel_id`, `nombre`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `alumno` (
    `id` CHAR(36) NOT NULL,
    `persona_id` CHAR(36) NOT NULL,
    `codigo_alumno` VARCHAR(30) NOT NULL,
    `fecha_ingreso` DATE NULL,
    `observaciones` TEXT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `alumno_persona_id_key`(`persona_id`),
    UNIQUE INDEX `alumno_codigo_alumno_key`(`codigo_alumno`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `docente` (
    `id` CHAR(36) NOT NULL,
    `persona_id` CHAR(36) NOT NULL,
    `codigo_docente` VARCHAR(30) NOT NULL,
    `especialidad` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `docente_persona_id_key`(`persona_id`),
    UNIQUE INDEX `docente_codigo_docente_key`(`codigo_docente`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `apoderado` (
    `id` CHAR(36) NOT NULL,
    `persona_id` CHAR(36) NOT NULL,
    `ocupacion` VARCHAR(100) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `apoderado_persona_id_key`(`persona_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `apoderado_alumno` (
    `apoderado_id` CHAR(36) NOT NULL,
    `alumno_id` CHAR(36) NOT NULL,
    `parentesco` VARCHAR(50) NOT NULL,
    `es_principal` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_by` CHAR(36) NULL,

    INDEX `apoderado_alumno_alumno_id_idx`(`alumno_id`),
    PRIMARY KEY (`apoderado_id`, `alumno_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `matricula` (
    `id` CHAR(36) NOT NULL,
    `alumno_id` CHAR(36) NOT NULL,
    `seccion_id` CHAR(36) NOT NULL,
    `anio_id` CHAR(36) NOT NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'SOLICITADA',
    `fecha_matricula` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `matricula_seccion_id_idx`(`seccion_id`),
    INDEX `matricula_anio_id_idx`(`anio_id`),
    UNIQUE INDEX `matricula_alumno_anio_key`(`alumno_id`, `anio_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `asignacion_docente` (
    `id` CHAR(36) NOT NULL,
    `docente_id` CHAR(36) NOT NULL,
    `curso_id` CHAR(36) NOT NULL,
    `seccion_id` CHAR(36) NOT NULL,
    `anio_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,

    INDEX `asignacion_docente_seccion_id_idx`(`seccion_id`),
    INDEX `asignacion_docente_anio_id_idx`(`anio_id`),
    UNIQUE INDEX `asignacion_docente_key`(`docente_id`, `curso_id`, `seccion_id`, `anio_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `auditoria` (
    `id` CHAR(36) NOT NULL,
    `usuario_id` CHAR(36) NULL,
    `accion` VARCHAR(50) NOT NULL,
    `entidad` VARCHAR(60) NOT NULL,
    `entidad_id` CHAR(36) NULL,
    `datos` JSON NULL,
    `ip` VARCHAR(45) NULL,
    `user_agent` VARCHAR(255) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `auditoria_entidad_entidad_id_idx`(`entidad`, `entidad_id`),
    INDEX `auditoria_usuario_id_created_at_idx`(`usuario_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `usuario` ADD CONSTRAINT `usuario_persona_id_fkey` FOREIGN KEY (`persona_id`) REFERENCES `persona`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario_rol` ADD CONSTRAINT `usuario_rol_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usuario_rol` ADD CONSTRAINT `usuario_rol_rol_id_fkey` FOREIGN KEY (`rol_id`) REFERENCES `rol`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `sesion_refresh` ADD CONSTRAINT `sesion_refresh_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `token_recuperacion` ADD CONSTRAINT `token_recuperacion_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anio_academico` ADD CONSTRAINT `anio_academico_institucion_id_fkey` FOREIGN KEY (`institucion_id`) REFERENCES `institucion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `periodo_academico` ADD CONSTRAINT `periodo_academico_anio_id_fkey` FOREIGN KEY (`anio_id`) REFERENCES `anio_academico`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nivel` ADD CONSTRAINT `nivel_institucion_id_fkey` FOREIGN KEY (`institucion_id`) REFERENCES `institucion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `grado` ADD CONSTRAINT `grado_nivel_id_fkey` FOREIGN KEY (`nivel_id`) REFERENCES `nivel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `seccion` ADD CONSTRAINT `seccion_grado_id_fkey` FOREIGN KEY (`grado_id`) REFERENCES `grado`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `seccion` ADD CONSTRAINT `seccion_anio_id_fkey` FOREIGN KEY (`anio_id`) REFERENCES `anio_academico`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `curso` ADD CONSTRAINT `curso_nivel_id_fkey` FOREIGN KEY (`nivel_id`) REFERENCES `nivel`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alumno` ADD CONSTRAINT `alumno_persona_id_fkey` FOREIGN KEY (`persona_id`) REFERENCES `persona`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `docente` ADD CONSTRAINT `docente_persona_id_fkey` FOREIGN KEY (`persona_id`) REFERENCES `persona`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apoderado` ADD CONSTRAINT `apoderado_persona_id_fkey` FOREIGN KEY (`persona_id`) REFERENCES `persona`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apoderado_alumno` ADD CONSTRAINT `apoderado_alumno_apoderado_id_fkey` FOREIGN KEY (`apoderado_id`) REFERENCES `apoderado`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `apoderado_alumno` ADD CONSTRAINT `apoderado_alumno_alumno_id_fkey` FOREIGN KEY (`alumno_id`) REFERENCES `alumno`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matricula` ADD CONSTRAINT `matricula_alumno_id_fkey` FOREIGN KEY (`alumno_id`) REFERENCES `alumno`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matricula` ADD CONSTRAINT `matricula_seccion_id_fkey` FOREIGN KEY (`seccion_id`) REFERENCES `seccion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `matricula` ADD CONSTRAINT `matricula_anio_id_fkey` FOREIGN KEY (`anio_id`) REFERENCES `anio_academico`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asignacion_docente` ADD CONSTRAINT `asignacion_docente_docente_id_fkey` FOREIGN KEY (`docente_id`) REFERENCES `docente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asignacion_docente` ADD CONSTRAINT `asignacion_docente_curso_id_fkey` FOREIGN KEY (`curso_id`) REFERENCES `curso`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asignacion_docente` ADD CONSTRAINT `asignacion_docente_seccion_id_fkey` FOREIGN KEY (`seccion_id`) REFERENCES `seccion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asignacion_docente` ADD CONSTRAINT `asignacion_docente_anio_id_fkey` FOREIGN KEY (`anio_id`) REFERENCES `anio_academico`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `auditoria` ADD CONSTRAINT `auditoria_usuario_id_fkey` FOREIGN KEY (`usuario_id`) REFERENCES `usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
