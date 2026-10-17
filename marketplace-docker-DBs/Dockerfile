# The stock mongod image plus one thing it cannot be given at runtime: the replica-set keyfile.
#
# MongoDB refuses to start unless the keyfile is owned by the user mongod runs as and is mode 400 or
# 600 — and a bind-mounted host file arrives with the host's uid/gid, which is almost never 999. So
# the file is baked in with the right owner and mode instead of mounted.
#
# `./up.sh` generates secrets/mongo-keyfile before building; it is gitignored, per-machine, and
# shared by all three nodes because that is what internal authentication means.

# ⚠️ The base is pinned by digest as well as by tag. A tag is mutable: `mongo:8.0` moves at every patch release
# and again whenever the same patch is rebuilt on a newer base image. OpenSSF Scorecard's Pinned-Dependencies
# check grades exactly that (the gate on that score is ADR-054). The digest is the multi-arch INDEX of `mongo:8.0`, not one platform's
# manifest, so an arm64 host still builds. To bump it, read the current value and replace the one on the FROM
# line below:
#
#   docker buildx imagetools inspect mongo:8.0 --format '{{.Manifest.Digest}}'
#
# Always read it yourself. A digest copied from a Scorecard result is the one the viewer showed as of its last
# scan, which can already be behind the tag. Dependabot cannot see the FROM line (it does not resolve an ARG
# inside a tag), so the digest is a hand-bump.
#
# ⚠️ Docker resolves a reference that carries both a tag and a digest by the digest alone and never looks at the
# tag: `mongo:no-such-tag@sha256:...` pulls fine. So MONGO_TAG cannot move this image, and a MONGO_TAG that
# disagrees with the digest would build the pinned image under the wrong name. The RUN below turns that into a
# failed build. To change series, change MONGO_TAG and the digest together.
#
# The RUN compares the SERIES only: mongod's own version against MONGO_TAG with any `-suffix` stripped. It
# catches MONGO_TAG=8.2, but MONGO_TAG=8 or an exact patch with a suffix such as 8.0.34-noble also passes
# without proving that the image is that one. Only the digest selects the image.
ARG MONGO_TAG=8.0
FROM mongo:${MONGO_TAG}@sha256:4a4ab5d4834207389e0d7270fac988e21ffedccecba77991a552f755df229907

# Re-declared without a value so this stage sees the global default or the build argument.
ARG MONGO_TAG
RUN mongod --version | grep -Eq "^db version v${MONGO_TAG%%-*}(\.|\$)" \
	|| { echo "MONGO_TAG=${MONGO_TAG} does not match the pinned digest, which is $(mongod --version | head -n 1); change MONGO_TAG and the digest together (see the comment above FROM in the Dockerfile)" >&2; exit 1; }

# ⚠️ The directory is created here, deliberately, and not left to COPY. BuildKit applies `--chmod` to
# every parent directory it has to create along the way, so a bare COPY into /etc/mongo/keyfile leaves
# /etc/mongo itself at mode 400 — a directory with no execute bit, which nothing can traverse. mongod
# then fails to read a keyfile whose own owner and mode are perfectly correct, and says only
# "Permission denied" followed by "Unable to acquire security key[s]", which reads like a keyfile
# problem and is not one. 0755 on the directory, 400 on the file, both owned by mongodb.
RUN install -d -m 0755 -o mongodb -g mongodb /etc/mongo

COPY --chown=mongodb:mongodb --chmod=400 secrets/mongo-keyfile /etc/mongo/keyfile
