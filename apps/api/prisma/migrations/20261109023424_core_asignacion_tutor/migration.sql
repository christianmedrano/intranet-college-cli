-- AlterTable
ALTER TABLE `asignacion_docente` ADD COLUMN `es_tutor` BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX `asignacion_docente_seccion_id_anio_id_es_tutor_idx` ON `asignacion_docente`(`seccion_id`, `anio_id`, `es_tutor`);
