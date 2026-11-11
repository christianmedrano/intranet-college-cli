-- CreateTable
CREATE TABLE `anuncios` (
    `id` CHAR(36) NOT NULL,
    `institucion_id` CHAR(36) NOT NULL,
    `autor_id` CHAR(36) NOT NULL,
    `titulo` VARCHAR(200) NOT NULL,
    `cuerpo` TEXT NOT NULL,
    `tipo` VARCHAR(20) NOT NULL,
    `estado` VARCHAR(20) NOT NULL DEFAULT 'BORRADOR',
    `audiencia_niveles` JSON NOT NULL,
    `audiencia_grados` JSON NOT NULL,
    `audiencia_secciones` JSON NOT NULL,
    `audiencia_roles` JSON NOT NULL,
    `publicado_en` DATETIME(3) NULL,
    `expira_en` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `created_by` CHAR(36) NULL,
    `updated_by` CHAR(36) NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `anuncios_institucion_id_estado_idx`(`institucion_id`, `estado`),
    INDEX `anuncios_tipo_estado_idx`(`tipo`, `estado`),
    INDEX `anuncios_publicado_en_idx`(`publicado_en`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `adjuntos_anuncio` (
    `id` CHAR(36) NOT NULL,
    `anuncio_id` CHAR(36) NOT NULL,
    `nombre_original` VARCHAR(255) NOT NULL,
    `nombre_almacenado` VARCHAR(500) NOT NULL,
    `tipo_mime` VARCHAR(100) NOT NULL,
    `tamano_bytes` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `hilos_mensajeria` (
    `id` CHAR(36) NOT NULL,
    `seccion_id` CHAR(36) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `hilos_mensajeria_seccion_id_key`(`seccion_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `mensajes_seccion` (
    `id` CHAR(36) NOT NULL,
    `hilo_id` CHAR(36) NOT NULL,
    `autor_id` CHAR(36) NOT NULL,
    `cuerpo` TEXT NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `mensajes_seccion_hilo_id_created_at_idx`(`hilo_id`, `created_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- CreateTable
CREATE TABLE `adjuntos_mensaje` (
    `id` CHAR(36) NOT NULL,
    `mensaje_id` CHAR(36) NOT NULL,
    `nombre_original` VARCHAR(255) NOT NULL,
    `nombre_almacenado` VARCHAR(500) NOT NULL,
    `tipo_mime` VARCHAR(100) NOT NULL,
    `tamano_bytes` INTEGER NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- AddForeignKey
ALTER TABLE `anuncios` ADD CONSTRAINT `anuncios_institucion_id_fkey` FOREIGN KEY (`institucion_id`) REFERENCES `institucion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `anuncios` ADD CONSTRAINT `anuncios_autor_id_fkey` FOREIGN KEY (`autor_id`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adjuntos_anuncio` ADD CONSTRAINT `adjuntos_anuncio_anuncio_id_fkey` FOREIGN KEY (`anuncio_id`) REFERENCES `anuncios`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `hilos_mensajeria` ADD CONSTRAINT `hilos_mensajeria_seccion_id_fkey` FOREIGN KEY (`seccion_id`) REFERENCES `seccion`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mensajes_seccion` ADD CONSTRAINT `mensajes_seccion_hilo_id_fkey` FOREIGN KEY (`hilo_id`) REFERENCES `hilos_mensajeria`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `mensajes_seccion` ADD CONSTRAINT `mensajes_seccion_autor_id_fkey` FOREIGN KEY (`autor_id`) REFERENCES `usuario`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `adjuntos_mensaje` ADD CONSTRAINT `adjuntos_mensaje_mensaje_id_fkey` FOREIGN KEY (`mensaje_id`) REFERENCES `mensajes_seccion`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
