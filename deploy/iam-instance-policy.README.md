# The instance role's S3 policy

`greatsales-app-instance` is the IAM role the production box assumes. It carries
`AmazonSSMManagedInstanceCore` (attached, managed — that is what makes `pnpm box`
work without SSH) plus one inline policy, `greatsales-deploy-buckets`, whose
document is `iam-instance-policy.json` beside this file.

Apply it after any change:

```bash
aws iam put-role-policy \
  --role-name greatsales-app-instance \
  --policy-name greatsales-deploy-buckets \
  --policy-document file://deploy/iam-instance-policy.json
```

It grants exactly four things, and each one is load-bearing:

| Grant | Why the box breaks without it |
| --- | --- |
| Read `greatsales-deploy-…-aps1` | `pnpm deploy:aws` ships images as a tarball through this bucket. Without it `docker load` never gets a file and every deploy fails. |
| Write `greatsales-backups-…-aps1/*` | The nightly `greatsales-backup.timer` pipes `pg_dump` straight to S3. Without it the timer fails and there is no restore point. |
| Read/write `greatsales-attachments-…-aps1/*` | `STORAGE_DRIVER=s3`, so every customer attachment upload goes here. |
| Read `greatsales-backups-…-euw2` | The **London** bucket from the previous box, kept read-only so its historical dumps (through 2026-09-09) can still be restored onto this box. |

The write grant is `PutObject` only — deliberately. A box that can delete its own
backups is one compromise away from having none, so lifecycle expiry is the
bucket's job, not the instance's.

Note that the attachments bucket did **not** exist on the previous box even
though `S3_BUCKET` pointed at a name: uploads had no working destination. It is
created and granted here.
