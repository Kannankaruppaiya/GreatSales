import '../load-env'; // authoritative greatsales_app DATABASE_URL (RLS-bound)
import { reseedTestDatabase } from '../test-support/reseed';
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { attachmentDownloadPath, type RequestUser } from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService, type UploadedFile } from './attachments.service';
import { StorageService } from './storage.service';

/**
 * Attachments.
 *
 * The interesting assertions are all about authorization, because an attachment
 * carries no permission of its own: it inherits the parent record's, through
 * the same helper remarks use. So the tests that matter are the ones proving a
 * salesperson cannot reach another rep's paperwork — by listing it, by
 * downloading it, or by attaching to it — since that is what a `attachment.read`
 * key of its own would have quietly allowed.
 *
 * Storage is the real local driver writing to a temp directory, not a stub. The
 * ordering this service is careful about — row then object, object then row on
 * the way out — is only observable against something that can actually fail.
 */
const ACME = 'tenant_acme';

const admin: RequestUser = {
  userId: 'user_admin_acme',
  tenantId: ACME,
  roleId: 'role_admin_acme',
};
const sales1: RequestUser = {
  userId: 'user_sales1_acme',
  tenantId: ACME,
  roleId: 'role_sales_acme',
};
const sales2: RequestUser = {
  userId: 'user_sales2_acme',
  tenantId: ACME,
  roleId: 'role_sales_acme',
};

const pdf = (name = 'quote.pdf'): UploadedFile => ({
  originalname: name,
  mimetype: 'application/pdf',
  size: 12,
  buffer: Buffer.from('%PDF-1.4 fake'),
});

describe('AttachmentsService (integration)', () => {
  let prisma: PrismaService;
  let attachments: AttachmentsService;
  let storage: StorageService;
  let dir: string;
  let customerId: string;

  beforeAll(async () => {
    reseedTestDatabase();
    prisma = new PrismaService(process.env.DATABASE_URL as string);
    await prisma.onModuleInit();

    dir = await mkdtemp(join(tmpdir(), 'gs-attach-'));
    storage = new StorageService({
      get: (key: string) =>
        ({ STORAGE_DRIVER: 'local', STORAGE_LOCAL_DIR: dir })[key],
      getOrThrow: (key: string) => key,
    } as unknown as ConfigService);
    storage.onModuleInit();
    attachments = new AttachmentsService(prisma, storage);

    // sales1 owns this account; sales2 does not.
    const customer = await prisma.forTenant(ACME).customer.findFirst({
      where: { salespersonId: sales1.userId, deletedAt: null },
      select: { id: true },
    });
    customerId = customer!.id;
  }, 120_000);

  afterAll(async () => {
    await prisma.onModuleDestroy();
    await rm(dir, { recursive: true, force: true });
  });

  it('stores a file and lists it against the record', async () => {
    const saved = await attachments.upload(
      admin,
      { entityType: 'Customer', entityId: customerId },
      pdf('signed quotation.pdf'),
    );
    expect(saved).toMatchObject({
      fileName: 'signed quotation.pdf',
      size: 12,
      uploadedById: admin.userId,
    });
    // Through the API, never a bucket URL: a signed link grants a business
    // document to whoever holds it, with no reference to who is asking.
    expect(attachmentDownloadPath(saved.id)).toBe(
      `/attachments/${saved.id}/download`,
    );

    const listed = await attachments.list(admin, {
      entityType: 'Customer',
      entityId: customerId,
    });
    expect(listed.map((a) => a.id)).toContain(saved.id);
  });

  it('gives back the bytes that were stored', async () => {
    const saved = await attachments.upload(
      admin,
      { entityType: 'Customer', entityId: customerId },
      pdf(),
    );
    const got = await attachments.download(admin, saved.id);
    expect(got.body.toString()).toBe('%PDF-1.4 fake');
    expect(got.contentType).toBe('application/pdf');
  });

  it('refuses a type that is not on the allow-list, and says what is', async () => {
    await expect(
      attachments.upload(
        admin,
        { entityType: 'Customer', entityId: customerId },
        {
          originalname: 'payload.exe',
          mimetype: 'application/x-msdownload',
          size: 4,
          buffer: Buffer.from('MZ'),
        },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    await expect(
      attachments.upload(
        admin,
        { entityType: 'Customer', entityId: customerId },
        {
          originalname: 'payload.exe',
          mimetype: 'application/x-msdownload',
          size: 4,
          buffer: Buffer.from('MZ'),
        },
      ),
      // The refusal names what IS accepted — "unsupported file type" leaves
      // the user guessing which of their files to convert.
    ).rejects.toThrow(/pdf/);
  });

  it('refuses a file over the size limit', async () => {
    await expect(
      attachments.upload(
        admin,
        { entityType: 'Customer', entityId: customerId },
        { ...pdf(), size: 11 * 1024 * 1024 },
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('keeps one salesperson out of another’s paperwork', async () => {
    const saved = await attachments.upload(
      sales1,
      { entityType: 'Customer', entityId: customerId },
      pdf('sales1 only.pdf'),
    );

    // Listing, downloading and attaching are three separate doors and all
    // three have to be shut — an attachment carries no key of its own, so the
    // parent's reachability is the whole of the check.
    await expect(
      attachments.list(sales2, {
        entityType: 'Customer',
        entityId: customerId,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);

    await expect(attachments.download(sales2, saved.id)).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    await expect(
      attachments.upload(
        sales2,
        { entityType: 'Customer', entityId: customerId },
        pdf(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('leaves no row behind when the file cannot be stored', async () => {
    const boom = jest
      .spyOn(storage, 'put')
      .mockRejectedValueOnce(new Error('bucket is on fire'));

    const before = await attachments.list(admin, {
      entityType: 'Customer',
      entityId: customerId,
    });
    await expect(
      attachments.upload(
        admin,
        { entityType: 'Customer', entityId: customerId },
        pdf('doomed.pdf'),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    // A row left behind would be listed to the user as a file and then fail to
    // download, which is worse than the upload plainly failing.
    const after = await attachments.list(admin, {
      entityType: 'Customer',
      entityId: customerId,
    });
    expect(after).toHaveLength(before.length);
    boom.mockRestore();
  });

  it('removes the row and the object together', async () => {
    const saved = await attachments.upload(
      admin,
      { entityType: 'Customer', entityId: customerId },
      pdf('to delete.pdf'),
    );
    await attachments.remove(admin, saved.id);

    const listed = await attachments.list(admin, {
      entityType: 'Customer',
      entityId: customerId,
    });
    expect(listed.map((a) => a.id)).not.toContain(saved.id);
  });

  it('refuses a parent that does not exist rather than orphaning a file', async () => {
    await expect(
      attachments.upload(
        admin,
        { entityType: 'Customer', entityId: 'cust_not_a_real_id' },
        pdf(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
