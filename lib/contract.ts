export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "0x7Ee7a3088C2E5295f3390538377ad0fCc3B126Be"

export const EVM_RPC = process.env.NEXT_PUBLIC_EVM_RPC || "http://localhost:8545"
export const COSMOS_RPC = process.env.NEXT_PUBLIC_COSMOS_RPC || "http://localhost:26657"
export const REST_API = process.env.NEXT_PUBLIC_REST_API || "http://localhost:1317"

export const CONTRACT_ABI = [
  "function createJob(string title, string description, uint256 deadlineDays) payable returns (uint256)",
  "function acceptJob(uint256 jobId)",
  "function submitWork(uint256 jobId, string workLink)",
  "function releasePayment(uint256 jobId)",
  "function cancelJob(uint256 jobId)",
  "function getJob(uint256 jobId) view returns (tuple(uint256 id, address client, address freelancer, string title, string description, uint256 amount, uint256 deadline, string workLink, string revisionNote, uint8 status))",
  "function getJobsByStatus(uint8 status) view returns (tuple(uint256 id, address client, address freelancer, string title, string description, uint256 amount, uint256 deadline, string workLink, string revisionNote, uint8 status)[])",
  "function requestRevision(uint256 jobId, string note)",
  "function reassignJob(uint256 jobId)",
  "function jobCount() view returns (uint256)",
  "event JobCreated(uint256 indexed jobId, address indexed client, string title, uint256 amount)",
  "event JobAccepted(uint256 indexed jobId, address indexed freelancer)",
  "event WorkSubmitted(uint256 indexed jobId, string workLink)",
  "event PaymentReleased(uint256 indexed jobId, address indexed freelancer, uint256 amount)",
]

export const STATUS: Record<number, string> = {
  0: "Open",
  1: "Active",
  2: "Pending Review",
  3: "Completed",
  4: "Cancelled",
}

export const STATUS_COLORS: Record<number, string> = {
  0: "bg-blue-100 text-blue-800",
  1: "bg-yellow-100 text-yellow-800",
  2: "bg-purple-100 text-purple-800",
  3: "bg-green-100 text-green-800",
  4: "bg-red-100 text-red-800",
}
