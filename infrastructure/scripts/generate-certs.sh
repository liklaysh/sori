#!/bin/bash

# Configuration
CERT_DIR="./infrastructure/ssl"
CERT_NAME="sori-wildcard"
DOMAIN="*.sori.orb.local"
ALT_DOMAIN="sori.orb.local"

echo "🔐 Generating Self-Signed Wildcard Certificate for ${DOMAIN}..."

# Create directory if it doesn't exist
mkdir -p ${CERT_DIR}

# Generate configuration file for SAN (Subject Alternative Names)
cat > ${CERT_DIR}/openssl.cnf <<EOF
[req]
default_bits = 2048
prompt = no
default_md = sha256
x509_extensions = v3_req
distinguished_name = dn

[dn]
C = US
ST = California
L = San Francisco
O = Sori Dev
CN = ${DOMAIN}

[v3_req]
subjectAltName = @alt_names

[alt_names]
DNS.1 = ${DOMAIN}
DNS.2 = ${ALT_DOMAIN}
EOF

# Generate Private Key and Certificate
openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout ${CERT_DIR}/${CERT_NAME}.key \
  -out ${CERT_DIR}/${CERT_NAME}.crt \
  -config ${CERT_DIR}/openssl.cnf \
  -extensions v3_req

# Cleanup config
rm ${CERT_DIR}/openssl.cnf

chmod 600 ${CERT_DIR}/${CERT_NAME}.key
chmod 644 ${CERT_DIR}/${CERT_NAME}.crt

echo "✅ Certificates generated in ${CERT_DIR}:"
ls -lh ${CERT_DIR}
