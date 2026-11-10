-- CreateTable
CREATE TABLE `calificacion` (
    `id` CHAR(36) NOT NULL,
    `alumno_id` CHAR(36) NOT NULL,
    `curso_id` CHAR(36) NOT NULL,
    `periodo_id` CHAR(36) NOT NULL,
    `valor` CHAR(2) NOT NULL,
    `observacion` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `calificacion_periodo_id_curso_id_idx`(`periodo_id`, `curso_id`),
    UNIQUE INDEX `calificacion_key`(`alumno_id`, `curso_id`, `periodo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `nota_final_periodo` (
    `id` CHAR(36) NOT NULL,
    `alumno_id` CHAR(36) NOT NULL,
    `curso_id` CHAR(36) NOT NULL,
    `periodo_id` CHAR(36) NOT NULL,
    `valor` CHAR(2) NOT NULL,
    `observacion` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `nota_final_periodo_periodo_id_curso_id_idx`(`periodo_id`, `curso_id`),
    UNIQUE INDEX `nota_final_periodo_key`(`alumno_id`, `curso_id`, `periodo_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `asistencia` (
    `id` CHAR(36) NOT NULL,
    `alumno_id` CHAR(36) NOT NULL,
    `fecha` DATE NOT NULL,
    `estado` VARCHAR(20) NOT NULL,
    `observacion` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `asistencia_fecha_idx`(`fecha`),
    UNIQUE INDEX `asistencia_key`(`alumno_id`, `fecha`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `justificacion_falta` (
    `id` CHAR(36) NOT NULL,
    `asistencia_id` CHAR(36) NOT NULL,
    `solicitante_usuario_id` CHAR(36) NOT NULL,
    `motivo` VARCHAR(500) NOT NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'SOLICITADA',
    `resuelto_por` CHAR(36) NULL,
    `resuelto_en` DATETIME(3) NULL,
    `motivo_resolucion` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `justificacion_falta_asistencia_id_estado_idx`(`asistencia_id`, `estado`),
    INDEX `justificacion_falta_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `umbral_asistencia` (
    `id` CHAR(36) NOT NULL,
    `anio_id` CHAR(36) NOT NULL,
    `faltas_para_alerta` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,

    UNIQUE INDEX `umbral_asistencia_anio_id_key`(`anio_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `alerta_asistencia` (
    `id` CHAR(36) NOT NULL,
    `alumno_id` CHAR(36) NOT NULL,
    `anio_id` CHAR(36) NOT NULL,
    `faltas_injustificadas` INTEGER NOT NULL,
    `umbral` INTEGER NOT NULL,
    `generada_en` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `actualizada_en` DATETIME(3) NOT NULL,

    INDEX `alerta_asistencia_anio_id_idx`(`anio_id`),
    UNIQUE INDEX `alerta_asistencia_key`(`alumno_id`, `anio_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `horario` (
    `id` CHAR(36) NOT NULL,
    `anio_id` CHAR(36) NOT NULL,
    `seccion_id` CHAR(36) NOT NULL,
    `curso_id` CHAR(36) NOT NULL,
    `docente_id` CHAR(36) NULL,
    `dia_semana` INTEGER NOT NULL,
    `hora_inicio` CHAR(5) NOT NULL,
    `hora_fin` CHAR(5) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `horario_docente_id_dia_semana_idx`(`docente_id`, `dia_semana`),
    INDEX `horario_anio_id_seccion_id_idx`(`anio_id`, `seccion_id`),
    UNIQUE INDEX `horario_bloque_key`(`seccion_id`, `dia_semana`, `hora_inicio`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `calificacion` ADD CONSTRAINT `calificacion_alumno_id_fkey` FOREIGN KEY (`alumno_id`) REFERENCES `alumno`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `calificacion` ADD CONSTRAINT `calificacion_curso_id_fkey` FOREIGN KEY (`curso_id`) REFERENCES `curso`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `calificacion` ADD CONSTRAINT `calificacion_periodo_id_fkey` FOREIGN KEY (`periodo_id`) REFERENCES `periodo_academico`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nota_final_periodo` ADD CONSTRAINT `nota_final_periodo_alumno_id_fkey` FOREIGN KEY (`alumno_id`) REFERENCES `alumno`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nota_final_periodo` ADD CONSTRAINT `nota_final_periodo_curso_id_fkey` FOREIGN KEY (`curso_id`) REFERENCES `curso`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `nota_final_periodo` ADD CONSTRAINT `nota_final_periodo_periodo_id_fkey` FOREIGN KEY (`periodo_id`) REFERENCES `periodo_academico`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `asistencia` ADD CONSTRAINT `asistencia_alumno_id_fkey` FOREIGN KEY (`alumno_id`) REFERENCES `alumno`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `justificacion_falta` ADD CONSTRAINT `justificacion_falta_asistencia_id_fkey` FOREIGN KEY (`asistencia_id`) REFERENCES `asistencia`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `justificacion_falta` ADD CONSTRAINT `justificacion_falta_solicitante_usuario_id_fkey` FOREIGN KEY (`solicitante_usuario_id`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `justificacion_falta` ADD CONSTRAINT `justificacion_falta_resuelto_por_fkey` FOREIGN KEY (`resuelto_por`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `umbral_asistencia` ADD CONSTRAINT `umbral_asistencia_anio_id_fkey` FOREIGN KEY (`anio_id`) REFERENCES `anio_academico`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alerta_asistencia` ADD CONSTRAINT `alerta_asistencia_alumno_id_fkey` FOREIGN KEY (`alumno_id`) REFERENCES `alumno`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `alerta_asistencia` ADD CONSTRAINT `alerta_asistencia_anio_id_fkey` FOREIGN KEY (`anio_id`) REFERENCES `anio_academico`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `horario` ADD CONSTRAINT `horario_anio_id_fkey` FOREIGN KEY (`anio_id`) REFERENCES `anio_academico`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `horario` ADD CONSTRAINT `horario_seccion_id_fkey` FOREIGN KEY (`seccion_id`) REFERENCES `seccion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `horario` ADD CONSTRAINT `horario_curso_id_fkey` FOREIGN KEY (`curso_id`) REFERENCES `curso`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `horario` ADD CONSTRAINT `horario_docente_id_fkey` FOREIGN KEY (`docente_id`) REFERENCES `docente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- CHECK: escala literal oficial (RN-ACAD-001)
ALTER TABLE `calificacion` ADD CONSTRAINT `calificacion_valor_check` CHECK (`valor` IN ('AD', 'A', 'B', 'C'));
ALTER TABLE `nota_final_periodo` ADD CONSTRAINT `nota_final_periodo_valor_check` CHECK (`valor` IN ('AD', 'A', 'B', 'C'));

-- CHECK: estados validos (RN-ACAD-009, RF-ACAD-006)
ALTER TABLE `asistencia` ADD CONSTRAINT `asistencia_estado_check` CHECK (`estado` IN ('PRESENTE', 'TARDE', 'FALTA_JUSTIFICADA', 'FALTA_INJUSTIFICADA'));
ALTER TABLE `justificacion_falta` ADD CONSTRAINT `justificacion_falta_estado_check` CHECK (`estado` IN ('SOLICITADA', 'APROBADA', 'RECHAZADA'));

-- CHECK: umbral entero positivo (RN-ACAD-013)
ALTER TABLE `umbral_asistencia` ADD CONSTRAINT `umbral_asistencia_positivo_check` CHECK (`faltas_para_alerta` > 0);
ALTER TABLE `alerta_asistencia` ADD CONSTRAINT `alerta_asistencia_valores_check` CHECK (`umbral` > 0 AND `faltas_injustificadas` >= 0);

-- CHECK: dia, formato y orden de horas (RN-ACAD-019)
ALTER TABLE `horario` ADD CONSTRAINT `horario_dia_semana_check` CHECK (`dia_semana` BETWEEN 1 AND 7);
ALTER TABLE `horario` ADD CONSTRAINT `horario_horas_check` CHECK (REGEXP_LIKE(`hora_inicio`, '^([01][0-9]|2[0-3]):[0-5][0-9]$') AND REGEXP_LIKE(`hora_fin`, '^([01][0-9]|2[0-3]):[0-5][0-9]$'));
ALTER TABLE `horario` ADD CONSTRAINT `horario_orden_horas_check` CHECK (`hora_inicio` < `hora_fin`);
