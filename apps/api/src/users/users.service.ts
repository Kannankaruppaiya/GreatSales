import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  UserCreate,
  UserListQuery,
  UserListResponse,
  UserRow,
  UserUpdate,
  RequestUser,
} from '@greatsales/shared';
import { PrismaService } from '../prisma/prisma.service';
import { hashPassword } from '../auth/hash';

/** Prisma include graph that carries everything a {@link UserRow} needs. */
const USER_INCLUDE = {
  role: true,
  manager: true,
  team: true,
} satisfies Prisma.UserInclude;

type UserWithGraph = Prisma.UserGetPayload<{ include: typeof USER_INCLUDE }>;

/** Public-safe projection — deliberately drops passwordHash. */
function toRow(u: UserWithGraph): UserRow {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    username: u.username,
    roleId: u.roleId,
    roleName: u.role.name,
    managerId: u.managerId,
    managerName: u.manager?.name ?? null,
    teamId: u.teamId,
    teamName: u.team?.name ?? null,
    active: u.active,
    lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  };
}

/** Postgres unique-violation code — surfaced as a 409 to the caller. */
function isUniqueViolation(e: unknown): boolean {
  return (
    e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002'
  );
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tenant-scoped (RLS) user list, cursor-paginated. Admin-side only. */
  async list(
    user: RequestUser,
    query: UserListQuery,
  ): Promise<UserListResponse> {
    const db = this.prisma.forTenant(user.tenantId);
    const rows = await db.user.findMany({
      where: {
        deletedAt: null,
        ...(query.roleId ? { roleId: query.roleId } : {}),
        ...(query.active !== undefined ? { active: query.active } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { email: { contains: query.search, mode: 'insensitive' } },
                { username: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: USER_INCLUDE,
      orderBy: { id: 'asc' },
      take: query.limit + 1,
      ...(query.cursor ? { cursor: { id: query.cursor }, skip: 1 } : {}),
    });

    const hasMore = rows.length > query.limit;
    const page = hasMore ? rows.slice(0, query.limit) : rows;
    return {
      items: page.map(toRow),
      nextCursor: hasMore ? page[page.length - 1].id : null,
    };
  }

  /** Create a tenant user; the plaintext password is hashed before store. */
  async create(user: RequestUser, body: UserCreate): Promise<UserRow> {
    const db = this.prisma.forTenant(user.tenantId);
    try {
      const created = await db.user.create({
        data: {
          tenant: { connect: { id: user.tenantId } },
          name: body.name,
          email: body.email,
          username: body.username,
          passwordHash: await hashPassword(body.password),
          role: { connect: { id: body.roleId } },
          ...(body.active !== undefined ? { active: body.active } : {}),
          ...(body.managerId
            ? { manager: { connect: { id: body.managerId } } }
            : {}),
          ...(body.teamId ? { team: { connect: { id: body.teamId } } } : {}),
        },
        include: USER_INCLUDE,
      });
      return toRow(created);
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Email or username already in use');
      }
      throw e;
    }
  }

  /** Partial edit; a supplied `password` is re-hashed, never stored raw. */
  async update(
    user: RequestUser,
    id: string,
    patch: UserUpdate,
  ): Promise<UserRow> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await db.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('User not found');

    const data: Prisma.UserUpdateInput = {};
    if (patch.name !== undefined) data.name = patch.name;
    if (patch.email !== undefined) data.email = patch.email;
    if (patch.username !== undefined) data.username = patch.username;
    if (patch.active !== undefined) data.active = patch.active;
    if (patch.password !== undefined)
      data.passwordHash = await hashPassword(patch.password);
    if (patch.roleId !== undefined)
      data.role = { connect: { id: patch.roleId } };
    if ('managerId' in patch) {
      data.manager = patch.managerId
        ? { connect: { id: patch.managerId } }
        : { disconnect: true };
    }
    if ('teamId' in patch) {
      data.team = patch.teamId
        ? { connect: { id: patch.teamId } }
        : { disconnect: true };
    }

    try {
      const updated = await db.user.update({
        where: { id },
        data,
        include: USER_INCLUDE,
      });
      return toRow(updated);
    } catch (e) {
      if (isUniqueViolation(e)) {
        throw new ConflictException('Email or username already in use');
      }
      throw e;
    }
  }

  /** Soft-delete: set deletedAt so the row drops out of every list. */
  async remove(user: RequestUser, id: string): Promise<void> {
    const db = this.prisma.forTenant(user.tenantId);
    const existing = await db.user.findFirst({
      where: { id, deletedAt: null },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('User not found');
    await db.user.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
