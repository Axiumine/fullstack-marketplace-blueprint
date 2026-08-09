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

COPY --chown=mongodb:mongodb --chmod=400 secrets/mongo-keyfile /etc/mongo/keyfile
