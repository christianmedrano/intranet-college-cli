-- AlterTable
ALTER TABLE `anuncios` ADD COLUMN `anio_id` CHAR(36) NULL;

-- AddForeignKey
ALTER TABLE `anuncios` ADD CONSTRAINT `anuncios_anio_id_fkey` FOREIGN KEY (`anio_id`) REFERENCES `anio_academico`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
