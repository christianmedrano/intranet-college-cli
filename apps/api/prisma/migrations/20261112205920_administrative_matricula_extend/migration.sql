-- AlterTable
ALTER TABLE `matricula` ADD COLUMN `fecha_aprobacion` DATETIME(3) NULL,
    ADD COLUMN `fecha_retiro` DATETIME(3) NULL,
    ADD COLUMN `fecha_solicitud` DATETIME(3) NULL,
    ADD COLUMN `motivo_retiro` VARCHAR(500) NULL,
    ADD COLUMN `observaciones` VARCHAR(500) NULL;

-- CreateIndex
CREATE INDEX `matricula_estado_idx` ON `matricula`(`estado`);
