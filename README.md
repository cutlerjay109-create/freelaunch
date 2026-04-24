# FreeLaunch — Trustless Freelance Escrow on Initia

> Ship work. Get paid instantly. No middleman.

FreeLaunch is an on-chain escrow platform for freelancers and clients built on Initia. Clients lock funds in a smart contract, freelancers complete work, and payment releases instantly — no Upwork cut (20%), no PayPal reversals, no waiting 7 days.

---

## The Problem

- Upwork takes 20% from freelancers
- Cross-border payments take days and cost extra fees
- Clients can ghost after work is delivered
- Freelancers have no protection against non-payment
- No trust between two anonymous parties

## The Solution

FreeLaunch uses smart contract escrow on Initia's 100ms block time chain:

1. Client posts a job and locks funds on-chain
2. Freelancer accepts and completes the work
3. Client reviews and releases payment instantly
4. Revision flow if work needs changes
5. Reassign flow if work is unacceptable
6. Auto-release after deadline protects freelancer from ghosting

---

## Features

- **Post jobs** with locked escrow funding
- **Accept open jobs** as a freelancer
- **Submit work** via link (GitHub, Figma, Google Docs, etc.)
- **Instant payment release** on approval
- **Request revision** — client sends note, freelancer resubmits
- **Reassign job** — client sends job back to open pool if freelancer fails
- **Auto-release** — protects freelancer if client goes silent after deadline
- **Cancel & refund** for unfilled jobs
- **Dashboard** showing balance, jobs posted, completed, earned, spent

---

## Tech Stack

- **Chain**: Initia EVM Rollup (`freelance-1`, Bridge ID: `1887`)
- **Smart Contract**: Solidity, deployed with Foundry
- **Frontend**: Next.js 16, TailwindCSS, TypeScript
- **Wallet**: MetaMask with InterwovenKit compatibility
- **Contract Interaction**: ethers.js v6

---

## Initia-Native Features Used

- Custom EVM appchain/rollup deployment via `weave` CLI
- Integration with Initia L1 (initiation-2) for data availability
- InterwovenKit-compatible wallet handling
- Session-style UX — MetaMask auto-switches to the FreeLaunch chain on connect

---

## Deployment

| Detail | Value |
|--------|-------|
| Chain ID | `freelance-1` |
| Bridge ID | `1887` |
| Contract Address | `0x7Ee7a3088C2E5295f3390538377ad0fCc3B126Be` |
| Deployment Tx | `0x36163672da9428d0167a708e49ea02eb016a7614cc564e69af193fac709a5998` |
| EVM RPC | `http://localhost:8545` |
| Cosmos RPC | `http://localhost:26657` |
| REST API | `http://localhost:1317` |

---

## Smart Contract Functions

| Function | Description |
|----------|-------------|
| `createJob(title, description, deadlineDays)` | Post a job and lock funds |
| `acceptJob(jobId)` | Accept an open job as freelancer |
| `submitWork(jobId, workLink)` | Submit work link for review |
| `releasePayment(jobId)` | Client releases payment to freelancer |
| `requestRevision(jobId, note)` | Client sends revision note, job back to Active |
| `reassignJob(jobId)` | Client returns job to Open, anyone can accept |
| `autoRelease(jobId)` | Anyone can trigger after deadline passes |
| `cancelJob(jobId)` | Client cancels unfilled job and gets refund |

---

## How to Run Locally

### Prerequisites

- Ubuntu/Linux machine
- Go 1.22+
- Node.js 20+
- Foundry (Solidity toolchain)
- Docker
- jq and lz4 utilities

### Step 1 — Install Dependencies

```bash
# Install Go 1.22+
sudo apt update
sudo apt install -y curl git build-essential
wget https://go.dev/dl/go1.22.0.linux-amd64.tar.gz
sudo rm -rf /usr/local/go
sudo tar -C /usr/local -xzf go1.22.0.linux-amd64.tar.gz
echo 'export PATH=$PATH:/usr/local/go/bin' >> ~/.bashrc
source ~/.bashrc

# Install Node.js
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install jq, lz4, docker-compose
apt install -y jq lz4 docker-compose

# Install Foundry
curl -L https://foundry.paradigm.xyz | bash
source ~/.bashrc
foundryup

# Install Weave CLI
curl -fsSL https://initia.io/install-weave.sh | bash
source ~/.bashrc
```

### Step 2 — Clone the Repo

```bash
git clone https://github.com/cutlerjay109-create/freelaunch.git
cd freelaunch
```

### Step 3 — Deploy Your Initia Rollup

```bash
weave init
```

Follow the interactive prompts:
- Select **Launch a new rollup**
- Select **Testnet (initiation-2)**
- Select **EVM** as your VM
- Set Chain ID: `freelance-1`
- Select **Initia L1** for data availability
- Enable **oracle price feed**
- Use the default preset for funding accounts
- Fund your Gas Station account via the Initia faucet when prompted

Fund your Gas Station wallet at **https://app.testnet.initia.xyz/faucet** then continue.

### Step 4 — Start the Chain

The `weave init` attempts to start the chain as a systemd service. If your environment doesn't have systemd (like Termux or Docker), start it manually:

```bash
# Find the minitiad binary
find / -name "minitiad" 2>/dev/null

# Add to PATH (adjust version if needed)
export PATH=$PATH:/root/.weave/data/minievm@v1.2.15
echo 'export PATH=$PATH:/root/.weave/data/minievm@v1.2.15' >> ~/.bashrc

# Start the chain
minitiad start --home ~/.minitia > ~/minitia.log 2>&1 &
disown

# Verify it's running
sleep 10
curl -s http://localhost:26657/status | jq '.result.sync_info.latest_block_height'
```

You should see an increasing block number.

### Step 5 — Deploy the Smart Contract

```bash
cd contracts

# Import your deployer wallet
MNEMONIC=$(jq -r '.common.gas_station.mnemonic' ~/.weave/config.json)
cast wallet import deployer --mnemonic "$MNEMONIC"
# Press Enter twice for no password

# Compile and deploy
forge build
forge create src/FreelanceEscrow.sol:FreelanceEscrow \
  --rpc-url http://localhost:8545 \
  --account deployer \
  --broadcast
```

Save the deployed contract address from the output.

### Step 6 — Configure the Frontend

```bash
cd ../frontend

# Create environment variables
cat > .env.local << EOF
NEXT_PUBLIC_CONTRACT_ADDRESS=<paste_your_contract_address_here>
NEXT_PUBLIC_EVM_RPC=http://localhost:8545
NEXT_PUBLIC_COSMOS_RPC=http://localhost:26657
NEXT_PUBLIC_REST_API=http://localhost:1317
EOF

# Install dependencies and run
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

### Step 7 — Add Chain to MetaMask

Open MetaMask → Network dropdown → Add a custom network:

| Field | Value |
|-------|-------|
| Network Name | `FreeLaunch` |
| RPC URL | `http://localhost:8545` |
| Chain ID | `2300653140824589` |
| Currency Symbol | `GAS` |

Save and switch to the FreeLaunch network.

### Step 8 — Fund Your Wallet

Send test GAS tokens to your MetaMask wallet:

```bash
cast send <your_metamask_address> \
  --value 100ether \
  --rpc-url http://localhost:8545 \
  --account deployer
```

### Step 9 — Test the Full Flow

1. Connect your wallet (Account 1) — acts as the **client**
2. Post a new job, fill in title, description, budget, deadline
3. Switch to a second MetaMask account — acts as the **freelancer**
4. Browse open jobs and accept one
5. Submit a work link
6. Switch back to Account 1
7. Click **Release Payment** — freelancer gets paid instantly

---

## Project Structure

```
freelaunch/
├── .initia/
│   └── submission.json         # Hackathon submission metadata
├── contracts/
│   └── src/
│       └── FreelanceEscrow.sol # Main escrow contract
├── frontend/
│   ├── app/
│   │   ├── page.tsx            # Main app UI
│   │   ├── layout.tsx          # Root layout
│   │   └── providers.tsx       # Context providers
│   ├── lib/
│   │   └── contract.ts         # Contract ABI and config
│   └── package.json
├── README.md
└── vercel.json
```

---

## Market Opportunity

- **$650B** global freelance market
- **20%** average platform cut on Upwork and Fiverr
- **1.5B+** unbanked workers who need trustless payments
- **30% YoY** growth of African freelance market
- **7 days** average payout delay on centralized platforms

---

## Why Initia

- **100ms block times** — payment confirmation feels instant
- **No gas tax** paid to third parties
- **Own the fee model** — we keep 100% of value captured
- **Own rollup** — full control over chain economics
- **InterwovenKit** makes wallet onboarding seamless

---

## Demo Video

[Add your YouTube demo link here]

---

## License

MIT
