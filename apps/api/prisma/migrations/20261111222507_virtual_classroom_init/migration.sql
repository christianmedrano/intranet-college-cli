-- CreateTable
CREATE TABLE `materiales_virtuales` (
    `id` CHAR(36) NOT NULL,
    `curso_id` CHAR(36) NOT NULL,
    `seccion_id` CHAR(36) NOT NULL,
    `periodo_id` CHAR(36) NOT NULL,
    `docente_id` CHAR(36) NOT NULL,
    `anio_id` CHAR(36) NOT NULL,
    `titulo` VARCHAR(200) NOT NULL,
    `descripcion` TEXT NULL,
    `archivo_nombre` VARCHAR(255) NOT NULL,
    `archivo_ruta` VARCHAR(500) NOT NULL,
    `archivo_mime` VARCHAR(100) NOT NULL,
    `tamano_bytes` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `materiales_virtuales_curso_id_seccion_id_periodo_id_idx`(`curso_id`, `seccion_id`, `periodo_id`),
    INDEX `materiales_virtuales_docente_id_idx`(`docente_id`),
    INDEX `materiales_virtual_docente_curso_seccion_periodo_titulo_key`(`curso_id`, `seccion_id`, `periodo_id`, `docente_id`, `titulo`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `adjuntos_virtuales` (
    `id` CHAR(36) NOT NULL,
    `material_id` CHAR(36) NOT NULL,
    `nombre_original` VARCHAR(255) NOT NULL,
    `nombre_almacenado` VARCHAR(500) NOT NULL,
    `tipo_mime` VARCHAR(100) NOT NULL,
    `tamano_bytes` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `materiales_virtuales` ADD CONSTRAINT `materiales_virtuales_curso_id_fkey` FOREIGN KEY (`curso_id`) REFERENCES `curso`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `materiales_virtuales` ADD CONSTRAINT `materiales_virtuales_seccion_id_fkey` FOREIGN KEY (`seccion_id`) REFERENCES `seccion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `materiales_virtuales` ADD CONSTRAINT `materiales_virtuales_periodo_id_fkey` FOREIGN KEY (`periodo_id`) REFERENCES `periodo_academico`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `materiales_virtuales` ADD CONSTRAINT `materiales_virtuales_docente_id_fkey` FOREIGN KEY (`docente_id`) REFERENCES `docente`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `materiales_virtuales` ADD CONSTRAINT `materiales_virtuales_anio_id_fkey` FOREIGN KEY (`anio_id`) REFERENCES `anio_academico`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adjuntos_virtuales` ADD CONSTRAINT `adjuntos_virtuales_material_id_fkey` FOREIGN KEY (`material_id`) REFERENCES `materiales_virtuales`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
