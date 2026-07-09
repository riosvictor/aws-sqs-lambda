#!/bin/sh
set -eu

AWS_REGION="${AWS_REGION:-us-east-1}"
AWS_ACCOUNT_ID="${AWS_ACCOUNT_ID:-000000000000}"
SNS_TOPIC_NAME="${SNS_TOPIC_NAME:-checkout-events}"
QUEUE_LOG_NAME="${QUEUE_LOG_NAME:-queue-logging}"
QUEUE_RESILIENT_NAME="${QUEUE_RESILIENT_NAME:-queue-resilient}"
QUEUE_RESILIENT_FINAL_DLQ_NAME="${QUEUE_RESILIENT_FINAL_DLQ_NAME:-queue-resilient-final-dlq}"
IDEMPOTENCY_TABLE_NAME="${IDEMPOTENCY_TABLE_NAME:-idempotency-checkout}"

TOPIC_ARN="arn:aws:sns:${AWS_REGION}:${AWS_ACCOUNT_ID}:${SNS_TOPIC_NAME}"
TMP_DIR="$(mktemp -d)"

cleanup() {
  rm -rf "${TMP_DIR}"
}

escape_json_string() {
  printf '%s' "$1" | sed 's/\\/\\\\/g; s/"/\\"/g' | tr -d '\n'
}

trap cleanup EXIT

echo "[localstack-init] creating topic ${SNS_TOPIC_NAME}"
awslocal sns create-topic --name "${SNS_TOPIC_NAME}" >/dev/null

echo "[localstack-init] creating queues"
awslocal sqs create-queue --queue-name "${QUEUE_LOG_NAME}" >/dev/null
awslocal sqs create-queue --queue-name "${QUEUE_RESILIENT_FINAL_DLQ_NAME}" >/dev/null

FINAL_DLQ_URL="$(awslocal sqs get-queue-url --queue-name "${QUEUE_RESILIENT_FINAL_DLQ_NAME}" --query 'QueueUrl' --output text)"
FINAL_DLQ_ARN="$(awslocal sqs get-queue-attributes --queue-url "${FINAL_DLQ_URL}" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)"
REDRIVE_POLICY=$(printf '{"deadLetterTargetArn":"%s","maxReceiveCount":"3"}' "${FINAL_DLQ_ARN}")

cat > "${TMP_DIR}/resilient-queue-attributes.json" <<EOF
{"RedrivePolicy":"$(escape_json_string "${REDRIVE_POLICY}")"}
EOF

awslocal sqs create-queue \
  --queue-name "${QUEUE_RESILIENT_NAME}" \
  --attributes "file://${TMP_DIR}/resilient-queue-attributes.json" >/dev/null

LOG_QUEUE_URL="$(awslocal sqs get-queue-url --queue-name "${QUEUE_LOG_NAME}" --query 'QueueUrl' --output text)"
LOG_QUEUE_ARN="$(awslocal sqs get-queue-attributes --queue-url "${LOG_QUEUE_URL}" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)"
RESILIENT_QUEUE_URL="$(awslocal sqs get-queue-url --queue-name "${QUEUE_RESILIENT_NAME}" --query 'QueueUrl' --output text)"
RESILIENT_QUEUE_ARN="$(awslocal sqs get-queue-attributes --queue-url "${RESILIENT_QUEUE_URL}" --attribute-names QueueArn --query 'Attributes.QueueArn' --output text)"

LOG_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSnsPublishToLoggingQueue",
      "Effect": "Allow",
      "Principal": { "Service": "sns.amazonaws.com" },
      "Action": "sqs:SendMessage",
      "Resource": "${LOG_QUEUE_ARN}",
      "Condition": {
        "ArnEquals": {
          "aws:SourceArn": "${TOPIC_ARN}"
        }
      }
    }
  ]
}
EOF
)

RESILIENT_POLICY=$(cat <<EOF
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "AllowSnsPublishToResilientQueue",
      "Effect": "Allow",
      "Principal": { "Service": "sns.amazonaws.com" },
      "Action": "sqs:SendMessage",
      "Resource": "${RESILIENT_QUEUE_ARN}",
      "Condition": {
        "ArnEquals": {
          "aws:SourceArn": "${TOPIC_ARN}"
        }
      }
    }
  ]
}
EOF
)

cat > "${TMP_DIR}/logging-policy-attributes.json" <<EOF
{"Policy":"$(escape_json_string "${LOG_POLICY}")"}
EOF

cat > "${TMP_DIR}/resilient-policy-attributes.json" <<EOF
{"Policy":"$(escape_json_string "${RESILIENT_POLICY}")"}
EOF

awslocal sqs set-queue-attributes --queue-url "${LOG_QUEUE_URL}" --attributes "file://${TMP_DIR}/logging-policy-attributes.json" >/dev/null
awslocal sqs set-queue-attributes --queue-url "${RESILIENT_QUEUE_URL}" --attributes "file://${TMP_DIR}/resilient-policy-attributes.json" >/dev/null

echo "[localstack-init] subscribing queues"
awslocal sns subscribe --topic-arn "${TOPIC_ARN}" --protocol sqs --notification-endpoint "${LOG_QUEUE_ARN}" >/dev/null
awslocal sns subscribe --topic-arn "${TOPIC_ARN}" --protocol sqs --notification-endpoint "${RESILIENT_QUEUE_ARN}" >/dev/null

echo "[localstack-init] ensuring dynamodb table ${IDEMPOTENCY_TABLE_NAME}"
if ! awslocal dynamodb describe-table --table-name "${IDEMPOTENCY_TABLE_NAME}" >/dev/null 2>&1; then
  awslocal dynamodb create-table \
    --table-name "${IDEMPOTENCY_TABLE_NAME}" \
    --attribute-definitions AttributeName=transactionId,AttributeType=S \
    --key-schema AttributeName=transactionId,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST >/dev/null
fi

awslocal dynamodb update-time-to-live \
  --table-name "${IDEMPOTENCY_TABLE_NAME}" \
  --time-to-live-specification Enabled=true,AttributeName=expiration >/dev/null 2>&1 || true

echo "[localstack-init] resources ready"