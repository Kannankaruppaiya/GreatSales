import { Module } from '@nestjs/common';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { StorageService } from './storage.service';
import { PermissionsGuard } from '../common/permissions.guard';

@Module({
  controllers: [AttachmentsController],
  providers: [AttachmentsService, StorageService, PermissionsGuard],
  exports: [AttachmentsService, StorageService],
})
export class AttachmentsModule {}
