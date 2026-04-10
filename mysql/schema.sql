CREATE DATABASE IF NOT EXISTS `crm_new_2026`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `crm_new_2026`;

CREATE TABLE IF NOT EXISTS `adminProfile` (
  `nombre` VARCHAR(255) NOT NULL,
  `avatarUrl` LONGTEXT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `users` (
  `id` VARCHAR(32) NOT NULL,
  `nombre` VARCHAR(255) NOT NULL,
  `email` VARCHAR(255) NOT NULL,
  `password` VARCHAR(255) NOT NULL,
  `codigoPropio` VARCHAR(64) NOT NULL,
  `referidoPor` VARCHAR(64) NULL,
  `fechaRegistro` DATETIME NOT NULL,
  `workspaceId` VARCHAR(64) NOT NULL,
  `role` VARCHAR(32) NOT NULL,
  `avatarUrl` LONGTEXT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_codigoPropio` (`codigoPropio`),
  UNIQUE KEY `uq_users_workspaceId` (`workspaceId`),
  KEY `idx_users_referidoPor` (`referidoPor`),
  KEY `idx_users_nombre` (`nombre`),
  KEY `idx_users_fechaRegistro` (`fechaRegistro`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `records` (
  `id` VARCHAR(64) NOT NULL,
  `nombre` VARCHAR(255) NOT NULL,
  `pais` VARCHAR(16) NOT NULL,
  `numero` VARCHAR(64) NOT NULL,
  `correo` VARCHAR(255) NOT NULL,
  `sector` VARCHAR(64) NOT NULL,
  `subsector` VARCHAR(255) NOT NULL,
  `origen` VARCHAR(128) NOT NULL,
  `fechaIngreso` DATETIME NOT NULL,
  `nota` TEXT NULL,
  `categoria` VARCHAR(32) NOT NULL,
  `canal` VARCHAR(64) NOT NULL,
  `estadoProspeccion` VARCHAR(64) NOT NULL,
  `mensajeEnviado` TINYINT(1) NOT NULL DEFAULT 0,
  `responsable` VARCHAR(255) NOT NULL,
  `propietarioId` VARCHAR(64) NOT NULL,
  `workspaceId` VARCHAR(64) NOT NULL,
  `inProspecting` TINYINT(1) NOT NULL DEFAULT 0,
  `isArchived` TINYINT(1) NOT NULL DEFAULT 0,
  `email` VARCHAR(255) NOT NULL,
  `notes` TEXT NULL,
  `isShared` TINYINT(1) NOT NULL DEFAULT 0,
  `sharedAt` DATETIME NULL,
  `sharedToUserId` VARCHAR(64) NULL,
  `sharedToUserName` VARCHAR(255) NULL,
  `receivedBatchId` VARCHAR(128) NULL,
  `receivedAt` DATETIME NULL,
  `sharedFromUserId` VARCHAR(64) NULL,
  `sharedFromUserName` VARCHAR(255) NULL,
  `sourceRecordId` VARCHAR(64) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_records_workspaceId` (`workspaceId`),
  KEY `idx_records_propietarioId` (`propietarioId`),
  KEY `idx_records_responsable` (`responsable`),
  KEY `idx_records_estadoProspeccion` (`estadoProspeccion`),
  KEY `idx_records_sector` (`sector`),
  KEY `idx_records_pais` (`pais`),
  KEY `idx_records_numero` (`numero`),
  KEY `idx_records_correo` (`correo`),
  KEY `idx_records_email` (`email`),
  KEY `idx_records_fechaIngreso` (`fechaIngreso`),
  KEY `idx_records_isShared` (`isShared`),
  KEY `idx_records_sharedToUserId` (`sharedToUserId`),
  KEY `idx_records_sharedFromUserId` (`sharedFromUserId`),
  KEY `idx_records_receivedBatchId` (`receivedBatchId`),
  KEY `idx_records_sourceRecordId` (`sourceRecordId`),
  KEY `idx_records_workspace_estado` (`workspaceId`, `estadoProspeccion`),
  KEY `idx_records_workspace_responsable` (`workspaceId`, `responsable`),
  KEY `idx_records_workspace_sector` (`workspaceId`, `sector`),
  KEY `idx_records_workspace_fechaIngreso` (`workspaceId`, `fechaIngreso`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `records_historial` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `recordId` VARCHAR(64) NOT NULL,
  `historial_index` INT NOT NULL,
  `fecha` DATETIME NOT NULL,
  `accion` TEXT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_records_historial_recordId` (`recordId`),
  KEY `idx_records_historial_fecha` (`fecha`),
  KEY `idx_records_historial_record_index` (`recordId`, `historial_index`),
  CONSTRAINT `fk_records_historial_recordId`
    FOREIGN KEY (`recordId`) REFERENCES `records` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `duplicateRecords` (
  `id` VARCHAR(64) NOT NULL,
  `nombre` VARCHAR(255) NOT NULL,
  `pais` VARCHAR(16) NOT NULL,
  `numero` VARCHAR(64) NOT NULL,
  `correo` VARCHAR(255) NOT NULL,
  `sector` VARCHAR(64) NOT NULL,
  `subsector` VARCHAR(255) NOT NULL,
  `origen` VARCHAR(128) NOT NULL,
  `fechaIngreso` DATETIME NOT NULL,
  `nota` TEXT NULL,
  `categoria` VARCHAR(32) NOT NULL,
  `canal` VARCHAR(64) NOT NULL,
  `estadoProspeccion` VARCHAR(64) NOT NULL,
  `mensajeEnviado` TINYINT(1) NOT NULL DEFAULT 0,
  `responsable` VARCHAR(255) NOT NULL,
  `propietarioId` VARCHAR(64) NOT NULL,
  `workspaceId` VARCHAR(64) NOT NULL,
  `inProspecting` TINYINT(1) NOT NULL DEFAULT 0,
  `isArchived` TINYINT(1) NOT NULL DEFAULT 0,
  `email` VARCHAR(255) NOT NULL,
  `notes` TEXT NULL,
  `isShared` TINYINT(1) NOT NULL DEFAULT 0,
  `sharedAt` DATETIME NULL,
  `sharedToUserId` VARCHAR(64) NULL,
  `sharedToUserName` VARCHAR(255) NULL,
  `receivedBatchId` VARCHAR(128) NULL,
  `receivedAt` DATETIME NULL,
  `sharedFromUserId` VARCHAR(64) NULL,
  `sharedFromUserName` VARCHAR(255) NULL,
  `sourceRecordId` VARCHAR(64) NULL,
  PRIMARY KEY (`id`),
  KEY `idx_duplicateRecords_workspaceId` (`workspaceId`),
  KEY `idx_duplicateRecords_propietarioId` (`propietarioId`),
  KEY `idx_duplicateRecords_numero` (`numero`),
  KEY `idx_duplicateRecords_correo` (`correo`),
  KEY `idx_duplicateRecords_sector` (`sector`),
  KEY `idx_duplicateRecords_estadoProspeccion` (`estadoProspeccion`),
  KEY `idx_duplicateRecords_isShared` (`isShared`),
  KEY `idx_duplicateRecords_sharedToUserId` (`sharedToUserId`),
  KEY `idx_duplicateRecords_sharedFromUserId` (`sharedFromUserId`),
  KEY `idx_duplicateRecords_receivedBatchId` (`receivedBatchId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `duplicateRecords_historial` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `recordId` VARCHAR(64) NOT NULL,
  `historial_index` INT NOT NULL,
  `fecha` DATETIME NOT NULL,
  `accion` TEXT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_duplicateRecords_historial_recordId` (`recordId`),
  KEY `idx_duplicateRecords_historial_fecha` (`fecha`),
  KEY `idx_duplicateRecords_historial_record_index` (`recordId`, `historial_index`),
  CONSTRAINT `fk_duplicateRecords_historial_recordId`
    FOREIGN KEY (`recordId`) REFERENCES `duplicateRecords` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sharedLinks` (
  `id` VARCHAR(64) NOT NULL,
  `hash` VARCHAR(128) NOT NULL,
  `date` DATETIME NOT NULL,
  `count` INT NOT NULL,
  `teamMemberId` VARCHAR(64) NOT NULL,
  `teamMemberName` VARCHAR(255) NOT NULL,
  `teamMemberCode` VARCHAR(64) NOT NULL,
  `workspaceId` VARCHAR(64) NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_sharedLinks_hash` (`hash`),
  KEY `idx_sharedLinks_workspaceId` (`workspaceId`),
  KEY `idx_sharedLinks_teamMemberId` (`teamMemberId`),
  KEY `idx_sharedLinks_teamMemberCode` (`teamMemberCode`),
  KEY `idx_sharedLinks_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sharedLinks_metrics` (
  `sharedLinkId` VARCHAR(64) NOT NULL,
  `viewed` INT NOT NULL DEFAULT 0,
  `worked` INT NOT NULL DEFAULT 0,
  `contacted` INT NOT NULL DEFAULT 0,
  PRIMARY KEY (`sharedLinkId`),
  CONSTRAINT `fk_sharedLinks_metrics_sharedLinkId`
    FOREIGN KEY (`sharedLinkId`) REFERENCES `sharedLinks` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sharedLinks_sourceRecordIds` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `sharedLinkId` VARCHAR(64) NOT NULL,
  `sourceRecordId` VARCHAR(64) NOT NULL,
  `sourceRecordIds_index` INT NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_sharedLinks_sourceRecordIds_sharedLinkId` (`sharedLinkId`),
  KEY `idx_sharedLinks_sourceRecordIds_sourceRecordId` (`sourceRecordId`),
  KEY `idx_sharedLinks_sourceRecordIds_sharedLinkId_index` (`sharedLinkId`, `sourceRecordIds_index`),
  CONSTRAINT `fk_sharedLinks_sourceRecordIds_sharedLinkId`
    FOREIGN KEY (`sharedLinkId`) REFERENCES `sharedLinks` (`id`)
    ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS `sessions` (
  `token` VARCHAR(128) NOT NULL,
  `userId` VARCHAR(64) NOT NULL,
  `role` VARCHAR(32) NOT NULL,
  `createdAt` DATETIME NOT NULL,
  `impersonatedBy` VARCHAR(64) NULL,
  PRIMARY KEY (`token`),
  KEY `idx_sessions_userId` (`userId`),
  KEY `idx_sessions_role` (`role`),
  KEY `idx_sessions_createdAt` (`createdAt`),
  KEY `idx_sessions_impersonatedBy` (`impersonatedBy`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
