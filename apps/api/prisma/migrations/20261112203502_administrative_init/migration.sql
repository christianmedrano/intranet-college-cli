-- CreateTable
CREATE TABLE `pago` (
    `id` CHAR(36) NOT NULL,
    `alumno_id` CHAR(36) NOT NULL,
    `concepto` VARCHAR(20) NOT NULL,
    `monto` DECIMAL(10, 2) NOT NULL,
    `moneda` CHAR(3) NOT NULL DEFAULT 'PEN',
    `fecha_pago` DATE NOT NULL,
    `metodo` VARCHAR(20) NOT NULL,
    `comprobante` VARCHAR(100) NULL,
    `observaciones` VARCHAR(500) NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'REGISTRADO',
    `anulado_motivo` VARCHAR(500) NULL,
    `anulado_por_id` CHAR(36) NULL,
    `anulado_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,

    INDEX `pago_alumno_id_idx`(`alumno_id`),
    INDEX `pago_fecha_pago_idx`(`fecha_pago`),
    INDEX `pago_estado_idx`(`estado`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `plantilla_certificado` (
    `id` CHAR(36) NOT NULL,
    `tipo` VARCHAR(20) NOT NULL,
    `nombre` VARCHAR(100) NOT NULL,
    `contenido` TEXT NOT NULL,
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `version` INTEGER NOT NULL DEFAULT 1,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `plantilla_certificado_tipo_idx`(`tipo`),
    UNIQUE INDEX `plantilla_certificado_tipo_version_key`(`tipo`, `version`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `certificado` (
    `id` CHAR(36) NOT NULL,
    `tipo` VARCHAR(20) NOT NULL,
    `numero` VARCHAR(50) NOT NULL,
    `alumno_id` CHAR(36) NOT NULL,
    `anio_id` CHAR(36) NOT NULL,
    `plantilla_id` CHAR(36) NULL,
    `variables` JSON NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
    `solicitado_por_id` CHAR(36) NULL,
    `solicitado_at` DATETIME(3) NULL,
    `aprobado_por_id` CHAR(36) NULL,
    `aprobado_at` DATETIME(3) NULL,
    `rechazado_motivo` VARCHAR(500) NULL,
    `pdf_ruta` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    UNIQUE INDEX `certificado_numero_key`(`numero`),
    INDEX `certificado_alumno_id_idx`(`alumno_id`),
    INDEX `certificado_anio_id_idx`(`anio_id`),
    INDEX `certificado_tipo_estado_idx`(`tipo`, `estado`),
    INDEX `certificado_numero_idx`(`numero`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `pago` ADD CONSTRAINT `pago_alumno_id_fkey` FOREIGN KEY (`alumno_id`) REFERENCES `alumno`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `pago` ADD CONSTRAINT `pago_anulado_por_id_fkey` FOREIGN KEY (`anulado_por_id`) REFERENCES `usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificado` ADD CONSTRAINT `certificado_alumno_id_fkey` FOREIGN KEY (`alumno_id`) REFERENCES `alumno`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificado` ADD CONSTRAINT `certificado_anio_id_fkey` FOREIGN KEY (`anio_id`) REFERENCES `anio_academico`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificado` ADD CONSTRAINT `certificado_plantilla_id_fkey` FOREIGN KEY (`plantilla_id`) REFERENCES `plantilla_certificado`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificado` ADD CONSTRAINT `certificado_solicitado_por_id_fkey` FOREIGN KEY (`solicitado_por_id`) REFERENCES `usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `certificado` ADD CONSTRAINT `certificado_aprobado_por_id_fkey` FOREIGN KEY (`aprobado_por_id`) REFERENCES `usuario`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;