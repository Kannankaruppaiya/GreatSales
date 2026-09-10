import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  AttachmentListQuerySchema,
  AttachmentUploadSchema,
  MAX_ATTACHMENT_BYTES,
  type AttachmentListQuery,
  type AttachmentUpload,
  type RequestUser,
} from '@greatsales/shared';
import {
  AttachmentsService,
  type UploadedFile as MulterFile,
} from './attachments.service';
import { CurrentUser } from '../common/decorators';
import { PermissionsGuard } from '../common/permissions.guard';
import { ZodValidationPipe } from '../common/zod-validation.pipe';

/**
 * Files on a record.
 *
 * Deliberately NOT decorated with @RequirePermissions, for the reason the
 * remarks controller gives: the key a call needs depends on the `entityType` it
 * carries — a file on a Payment needs `payment.read`, one on a Lead needs
 * `lead.read` — which the guard cannot see. AttachmentsService checks it per
 * request, along with whether the caller can reach the parent record at all.
 */
@ApiTags('attachments')
@ApiBearerAuth()
@UseGuards(PermissionsGuard)
@Controller('attachments')
export class AttachmentsController {
  constructor(private readonly service: AttachmentsService) {}

  @Get()
  list(
    @CurrentUser() user: RequestUser,
    @Query(new ZodValidationPipe(AttachmentListQuerySchema))
    query: AttachmentListQuery,
  ) {
    return this.service.list(user, query);
  }

  @Post()
  @UseInterceptors(
    FileInterceptor('file', {
      // In memory, then straight to storage. A disk temp file would need a
      // writable path in the container and a cleanup path for every failure,
      // for a 10 MB ceiling that comfortably fits in a request's lifetime.
      limits: { fileSize: MAX_ATTACHMENT_BYTES },
    }),
  )
  upload(
    @CurrentUser() user: RequestUser,
    @Body(new ZodValidationPipe(AttachmentUploadSchema)) body: AttachmentUpload,
    @UploadedFile() file: MulterFile | undefined,
  ) {
    return this.service.upload(user, body, file);
  }

  /**
   * The bytes.
   *
   * Sent as an attachment, never inline: a PDF or an image rendered in the
   * browser from this origin is content somebody else uploaded being executed
   * in the API's own context, and `nosniff` stops a helpful browser deciding
   * the declared type was wrong.
   */
  @Get(':id/download')
  async download(
    @CurrentUser() user: RequestUser,
    @Param('id') id: string,
    @Res() res: Response,
  ): Promise<void> {
    const file = await this.service.download(user, id);
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader(
      'Content-Disposition',
      // RFC 5987, so a name with spaces or non-ASCII survives the header.
      `attachment; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
    );
    res.send(file.body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(@CurrentUser() user: RequestUser, @Param('id') id: string) {
    return this.service.remove(user, id);
  }
}
