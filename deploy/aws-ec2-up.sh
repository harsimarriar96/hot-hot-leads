#!/usr/bin/env bash
# Provision an isolated single-host HotHotLeads environment on AWS:
# dedicated VPC + public subnet + IGW, security group, SSH key pair, IAM role with
# Bedrock invoke permissions, one Ubuntu 24.04 instance with Docker, and an Elastic IP.
# Re-runnable: every resource is looked up by its Name tag before being created.
#
# Usage: deploy/aws-ec2-up.sh <customer-name> [region] [instance-type]
# Writes connection details to ~/.config/hothotleads/<customer-name>.json
set -euo pipefail

SUFFIX=${1:?usage: $0 <customer-name> [region] [instance-type]}
export AWS_REGION=${2:-${AWS_REGION:-us-east-1}}
TYPE=${3:-t3.medium}
NAME="hothotleads-$SUFFIX"
STATE_DIR="$HOME/.config/hothotleads"
STATE="$STATE_DIR/$SUFFIX.json"
KEY_FILE="$HOME/.ssh/$NAME.pem"

log() { echo "==> $*" >&2; }
tagspec() { echo "ResourceType=$1,Tags=[{Key=Name,Value=$NAME},{Key=Project,Value=hothotleads},{Key=Deployment,Value=$SUFFIX}]"; }
find_tagged() { # <describe-noun> <jmespath> [extra filters...]
  local noun=$1 q=$2; shift 2
  aws ec2 "describe-$noun" --filters "Name=tag:Name,Values=$NAME" "$@" --query "$q" --output text 2>/dev/null | grep -v '^None$' || true
}

# ── network ──────────────────────────────────────────────────────────────────
VPC=$(find_tagged vpcs 'Vpcs[0].VpcId')
if [ -z "$VPC" ]; then
  log "creating VPC"
  VPC=$(aws ec2 create-vpc --cidr-block 10.42.0.0/16 --tag-specifications "$(tagspec vpc)" --query Vpc.VpcId --output text)
  aws ec2 modify-vpc-attribute --vpc-id "$VPC" --enable-dns-hostnames
fi
log "VPC $VPC"

SUBNET=$(find_tagged subnets 'Subnets[0].SubnetId' "Name=vpc-id,Values=$VPC")
if [ -z "$SUBNET" ]; then
  # Not every AZ offers every instance type (us-east-1e has no t3); pick one that does.
  AZ=$(aws ec2 describe-instance-type-offerings --location-type availability-zone \
        --filters "Name=instance-type,Values=$TYPE" --query 'sort_by(InstanceTypeOfferings,&Location)[0].Location' --output text)
  log "creating subnet in $AZ"
  SUBNET=$(aws ec2 create-subnet --vpc-id "$VPC" --cidr-block 10.42.1.0/24 --availability-zone "$AZ" --tag-specifications "$(tagspec subnet)" --query Subnet.SubnetId --output text)
  aws ec2 modify-subnet-attribute --subnet-id "$SUBNET" --map-public-ip-on-launch
fi
log "subnet $SUBNET"

IGW=$(find_tagged internet-gateways 'InternetGateways[0].InternetGatewayId')
if [ -z "$IGW" ]; then
  log "creating internet gateway"
  IGW=$(aws ec2 create-internet-gateway --tag-specifications "$(tagspec internet-gateway)" --query InternetGateway.InternetGatewayId --output text)
  aws ec2 attach-internet-gateway --internet-gateway-id "$IGW" --vpc-id "$VPC"
fi
log "IGW $IGW"

RTB=$(find_tagged route-tables 'RouteTables[0].RouteTableId' "Name=vpc-id,Values=$VPC")
if [ -z "$RTB" ]; then
  log "creating route table"
  RTB=$(aws ec2 create-route-table --vpc-id "$VPC" --tag-specifications "$(tagspec route-table)" --query RouteTable.RouteTableId --output text)
  aws ec2 create-route --route-table-id "$RTB" --destination-cidr-block 0.0.0.0/0 --gateway-id "$IGW" >/dev/null
fi
if ! aws ec2 describe-route-tables --route-table-ids "$RTB" --query 'RouteTables[0].Associations[].SubnetId' --output text | grep -q "$SUBNET"; then
  aws ec2 associate-route-table --route-table-id "$RTB" --subnet-id "$SUBNET" >/dev/null
fi
log "route table $RTB"

MY_IP=$(curl -fsS https://checkip.amazonaws.com | tr -d '[:space:]')
SG=$(find_tagged security-groups 'SecurityGroups[0].GroupId' "Name=vpc-id,Values=$VPC")
if [ -z "$SG" ]; then
  log "creating security group (80/443 open, 22 from $MY_IP)"
  SG=$(aws ec2 create-security-group --group-name "$NAME" --description "HotHotLeads $SUFFIX" --vpc-id "$VPC" --tag-specifications "$(tagspec security-group)" --query GroupId --output text)
  aws ec2 authorize-security-group-ingress --group-id "$SG" --ip-permissions \
    "IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=0.0.0.0/0}],Ipv6Ranges=[{CidrIpv6=::/0}]" \
    "IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0}],Ipv6Ranges=[{CidrIpv6=::/0}]" \
    "IpProtocol=tcp,FromPort=22,ToPort=22,IpRanges=[{CidrIp=$MY_IP/32,Description=operator}]" >/dev/null
fi
log "security group $SG"

# ── ssh key ──────────────────────────────────────────────────────────────────
if ! aws ec2 describe-key-pairs --key-names "$NAME" >/dev/null 2>&1; then
  log "creating key pair -> $KEY_FILE"
  aws ec2 create-key-pair --key-name "$NAME" --key-type ed25519 --tag-specifications "$(tagspec key-pair)" --query KeyMaterial --output text > "$KEY_FILE"
  chmod 600 "$KEY_FILE"
elif [ ! -f "$KEY_FILE" ]; then
  echo "key pair $NAME exists in AWS but $KEY_FILE is missing locally; delete the key pair or restore the file" >&2; exit 1
fi

# ── IAM role: Bedrock invoke only ────────────────────────────────────────────
ROLE="$NAME-ec2"
if ! aws iam get-role --role-name "$ROLE" >/dev/null 2>&1; then
  log "creating IAM role $ROLE"
  aws iam create-role --role-name "$ROLE" --tags "Key=Project,Value=hothotleads" "Key=Deployment,Value=$SUFFIX" \
    --assume-role-policy-document '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Principal":{"Service":"ec2.amazonaws.com"},"Action":"sts:AssumeRole"}]}' >/dev/null
  aws iam put-role-policy --role-name "$ROLE" --policy-name bedrock-invoke --policy-document '{
    "Version":"2012-10-17",
    "Statement":[
      {"Sid":"BedrockInvoke","Effect":"Allow",
       "Action":["bedrock:InvokeModel","bedrock:InvokeModelWithResponseStream","bedrock:ListInferenceProfiles","bedrock:GetInferenceProfile"],
       "Resource":["arn:aws:bedrock:*:*:inference-profile/*","arn:aws:bedrock:*:*:application-inference-profile/*","arn:aws:bedrock:*:*:foundation-model/*"]},
      {"Sid":"BedrockMarketplace","Effect":"Allow",
       "Action":["aws-marketplace:ViewSubscriptions","aws-marketplace:Subscribe"],"Resource":"*",
       "Condition":{"StringEquals":{"aws:CalledViaLast":"bedrock.amazonaws.com"}}}
    ]}'
  aws iam create-instance-profile --instance-profile-name "$ROLE" >/dev/null
  aws iam add-role-to-instance-profile --instance-profile-name "$ROLE" --role-name "$ROLE"
  log "waiting for IAM propagation"; sleep 12
fi

# ── instance ─────────────────────────────────────────────────────────────────
AMI=$(aws ssm get-parameter --name /aws/service/canonical/ubuntu/server/24.04/stable/current/amd64/hvm/ebs-gp3/ami-id --query Parameter.Value --output text)
USER_DATA=$(mktemp)
cat > "$USER_DATA" <<'CLOUD'
#!/bin/bash
set -eux
# 2 GB swap: the docker build and concurrent agent subprocesses are memory-hungry on a 4 GB box.
fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
apt-get update
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" > /etc/apt/sources.list.d/docker.list
apt-get update
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
usermod -aG docker ubuntu
mkdir -p /opt/hothotleads && chown ubuntu:ubuntu /opt/hothotleads
CLOUD

INSTANCE=$(find_tagged instances 'Reservations[0].Instances[0].InstanceId' "Name=instance-state-name,Values=pending,running,stopping,stopped")
if [ -z "$INSTANCE" ]; then
  log "launching $TYPE ($AMI)"
  INSTANCE=$(aws ec2 run-instances --image-id "$AMI" --instance-type "$TYPE" --subnet-id "$SUBNET" --security-group-ids "$SG" \
    --key-name "$NAME" --iam-instance-profile "Name=$ROLE" --user-data "file://$USER_DATA" \
    --block-device-mappings 'DeviceName=/dev/sda1,Ebs={VolumeSize=30,VolumeType=gp3,DeleteOnTermination=true}' \
    --metadata-options 'HttpTokens=required,HttpPutResponseHopLimit=2,HttpEndpoint=enabled' \
    --tag-specifications "$(tagspec instance)" "$(tagspec volume)" \
    --query 'Instances[0].InstanceId' --output text)
fi
rm -f "$USER_DATA"
log "instance $INSTANCE"

EIP_ALLOC=$(aws ec2 describe-addresses --filters "Name=tag:Name,Values=$NAME" --query 'Addresses[0].AllocationId' --output text | grep -v '^None$' || true)
if [ -z "$EIP_ALLOC" ]; then
  log "allocating Elastic IP"
  EIP_ALLOC=$(aws ec2 allocate-address --domain vpc --tag-specifications "$(tagspec elastic-ip)" --query AllocationId --output text)
fi
EIP=$(aws ec2 describe-addresses --allocation-ids "$EIP_ALLOC" --query 'Addresses[0].PublicIp' --output text)

log "waiting for instance to run"
aws ec2 wait instance-running --instance-ids "$INSTANCE"
aws ec2 associate-address --instance-id "$INSTANCE" --allocation-id "$EIP_ALLOC" --allow-reassociation >/dev/null
log "waiting for instance status checks"
aws ec2 wait instance-status-ok --instance-ids "$INSTANCE"

mkdir -p "$STATE_DIR"
cat > "$STATE" <<JSON
{"name":"$NAME","suffix":"$SUFFIX","region":"$AWS_REGION","instanceId":"$INSTANCE","publicIp":"$EIP","keyFile":"$KEY_FILE","vpcId":"$VPC","securityGroupId":"$SG","role":"$ROLE"}
JSON
log "done. state written to $STATE"
cat "$STATE"
