# The stock mongod image plus one thing it cannot be given at runtime: the replica-set keyfile.
#
# MongoDB refuses to start unless the keyfile is owned by the user mongod runs as and is mode 400 or
# 600 — and a bind-mounted host file arrives with the host's uid/gid, which is almost never 999. So
# the file is baked in with the right owner and mode instead of mounted.
#
# `./up.sh` generates secrets/mongo-keyfile before building; it is gitignored, per-machine, and
# shared by all three nodes because that is what internal authentication means.

ARG MONGO_TAG=8.0
FROM mongo:${MONGO_TAG}

# ⚠️ The directory is created here, deliberately, and not left to COPY. BuildKit applies `--chmod` to
# every parent directory it has to create along the way, so a bare COPY into /etc/mongo/keyfile leaves
# /etc/mongo itself at mode 400 — a directory with no execute bit, which nothing can traverse. mongod
# then fails to read a keyfile whose own owner and mode are perfectly correct, and says only
# "Permission denied" followed by "Unable to acquire security key[s]", which reads like a keyfile
# problem and is not one. 0755 on the directory, 400 on the file, both owned by mongodb.
RUN install -d -m 0755 -o mongodb -g mongodb /etc/mongo

COPY --chown=mongodb:mongodb --chmod=400 secrets/mongo-keyfile /etc/mongo/keyfile
