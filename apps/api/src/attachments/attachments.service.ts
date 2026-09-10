import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { EntityType } from '@prisma/client';
import {
  ALLOWED_ATTACHMENT_TYPES,
  MAX_ATTACHMENT_BYTES,
  type AttachmentListQuery,
  type AttachmentRow,
  type AttachmentUpload,
  type RequestUser,
} from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage.service';
import {
  assertEntityPermission,
  assertParentVisible,
} from '../common/entity-access';

/** What multer hands over, without depending on its types across the app. */
export interface UploadedFile {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

/**
 * Files attached to a record.
 *
 * Authorization is inherited from the parent, through the same helper remarks
 * use: reading an order's attachments needs `order.read` AND the order has to
 * be one this caller can reach, which for a sales user means one they own. A
 * separate `attachment.read` key would have let a role fetch the paperwork of
 * records it cannot open.
 *
 * The bytes and the row are written in that order, and deleted in the opposite
 * one. An orphaned OBJECT costs storage and nothing else; an orphaned ROW is
 * listed to the user as a file and then fails to download, which is the failure
 * they have to ask somebody about.
 */
@Injectable()
export class AttachmentsService {
  private readonly logger = new Logger(AttachmentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async list(
    user: RequestUser,
    query: AttachmentListQuery,
  ): Promise<AttachmentRow[]> {
    const db = this.prisma.forTenant(user.tenantId);
    await assertEntityPermission(
      db,
      user,
      query.entityType,
      'read',
      'attachments',
    );
    await assertParentVisible(db, user, query.entityType, query.entityId);

    const rows = await db.attachment.findMany({
      where: {
        entityType: query.entityType as EntityType,
        entityId: query.entityId,
      },
      include: { uploadedBy: true },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRow);
  }

  async upload(
    user: RequestUser,
    body: AttachmentUpload,
    file: UploadedFile | undefined,
  ): Promise<AttachmentRow> {
    if (!file) throw new BadRequestException('No file was uploaded.');

    // Checked here, not only by the upload widget — the widget is not what a
    // request has to get past. Multer's own limit rejects the truly large ones
    // before they are buffered; this catches everything else and says why.
    if (file.size > MAX_ATTACHMENT_BYTES) {
      throw new BadRequestException(
        `That file is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${
          MAX_ATTACHMENT_BYTES / 1024 / 1024
        } MB.`,
      );
    }
    if (!ALLOWED_ATTACHMENT_TYPES[file.mimetype]) {
      // An allow-list, and the refusal names what IS accepted: "unsupported
      // file type" leaves the user guessing which of their files to convert.
      throw new BadRequestException(
        `${file.mimetype} cannot be attached. Accepted: ${[
          ...new Set(Object.values(ALLOWED_ATTACHMENT_TYPES)),
        ].join(', ')}.`,
      );
    }

    const db = this.prisma.forTenant(user.tenantId);
    await assertEntityPermission(
      db,
      user,
      body.entityType,
      'write',
      'attachments',
    );
    await assertParentVisible(db, user, body.entityType, body.entityId);

    // The row first, for its id — the storage key carries it, so the object
    // name cannot collide and can always be traced back to a row.
    const created = await db.attachment.create({
      data: {
        tenantId: user.tenantId,
        entityType: body.entityType as EntityType,
        entityId: body.entityId,
        // Provisional: replaced below once the key is known. A row is never
        // visible with an empty key because the update is immediate and a
        // failure deletes the row.
        s3Key: '',
        fileName: file.originalname.slice(-200),
        size: file.size,
        uploadedById: user.userId,
      },
      include: { uploadedBy: true },
    });

    const key = this.storage.keyFor(
      user.tenantId,
      body.entityType,
      body.entityId,
      created.id,
      file.originalname,
    );

    try {
      await this.storage.put(key, file.buffer, file.mimetype);
    } catch (err) {
      // Take the row back out. Leaving it would list a file to the user that
      // cannot be downloaded, which is worse than the upload plainly failing.
      await db.attachment.delete({ where: { id: created.id } }).catch(() => {});
      this.logger.error(
        `Storing ${key} failed: ${err instanceof Error ? err.message : err}`,
      );
      throw new BadRequestException(
        'That file could not be stored. Please try again.',
      );
    }

    const saved = await db.attachment.update({
      where: { id: created.id },
      data: { s3Key: key },
      include: { uploadedBy: true },
    });
    return toRow(saved);
  }

  /**
   * The bytes, re-authorized.
   *
   * Every download goes through here rather than through a pre-signed bucket
   * URL. A signed link is shorter and it is also a URL that grants whoever
   * holds it a business document with no reference to who is asking; this
   * re-checks the caller against the parent record on every request, which is
   * the same rule the list obeys.
   */
  async download(
    user: RequestUser,
    id: string,
  ): Promise<{ fileName: string; body: Buffer; contentType: string }> {
    const db = this.prisma.forTenant(user.tenantId);
    const row = await db.attachment.findFirst({ where: { id } });
    if (!row) throw new NotFoundException('No such attachment.');

    await assertEntityPermission(
      db,
      user,
      row.entityType,
      'read',
      'attachments',
    );
    await assertParentVisible(db, user, row.entityType, row.entityId);

    const object = await this.storage.get(row.s3Key);
    return {
      fileName: row.fileName,
      body: object.body,
      contentType: object.contentType ?? 'application/octet-stream',
    };
  }

  async remove(user: RequestUser, id: string): Promise<void> {
    const db = this.prisma.forTenant(user.tenantId);
    const row = await db.attachment.findFirst({ where: { id } });
    if (!row) throw new NotFoundException('No such attachment.');

    await assertEntityPermission(
      db,
      user,
      row.entityType,
      'write',
      'attachments',
    );
    await assertParentVisible(db, user, row.entityType, row.entityId);

    // Row first, then the object: if the object delete fails, what is left is
    // an unreferenced file in a bucket, which costs storage. The other order
    // leaves a row pointing at nothing, which costs the user a support call.
    await db.attachment.delete({ where: { id } });
    await this.storage.remove(row.s3Key).catch((err) => {
      this.logger.warn(
        `Attachment ${id} was removed but its object ${row.s3Key} was not: ${
          err instanceof Error ? err.message : err
        }`,
      );
    });
  }
}

function toRow(a: {
  id: string;
  entityType: EntityType;
  entityId: string;
  fileName: string;
  size: number;
  uploadedById: string;
  uploadedBy: { name: string };
  createdAt: Date;
}): AttachmentRow {
  return {
    id: a.id,
    entityType: a.entityType,
    entityId: a.entityId,
    fileName: a.fileName,
    size: a.size,
    uploadedById: a.uploadedById,
    uploadedByName: a.uploadedBy.name,
    createdAt: a.createdAt.toISOString(),
  };
}
