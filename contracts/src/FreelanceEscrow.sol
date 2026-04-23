// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract FreelanceEscrow {
    enum Status { Open, Active, PendingReview, Completed, Cancelled }

    struct Job {
        uint256 id;
        address client;
        address freelancer;
        string title;
        string description;
        uint256 amount;
        uint256 deadline;
        string workLink;
        string revisionNote;
        Status status;
    }

    uint256 public jobCount;
    mapping(uint256 => Job) public jobs;

    event JobCreated(uint256 indexed jobId, address indexed client, string title, uint256 amount);
    event JobAccepted(uint256 indexed jobId, address indexed freelancer);
    event WorkSubmitted(uint256 indexed jobId, string workLink);
    event PaymentReleased(uint256 indexed jobId, address indexed freelancer, uint256 amount);
    event RevisionRequested(uint256 indexed jobId, string note);
    event JobReassigned(uint256 indexed jobId);
    event JobCancelled(uint256 indexed jobId);

    modifier onlyClient(uint256 jobId) {
        require(msg.sender == jobs[jobId].client, "Not the client");
        _;
    }

    modifier onlyFreelancer(uint256 jobId) {
        require(msg.sender == jobs[jobId].freelancer, "Not the freelancer");
        _;
    }

    function createJob(string calldata title, string calldata description, uint256 deadlineDays)
        external payable returns (uint256)
    {
        require(msg.value > 0, "Must fund the job");
        require(deadlineDays > 0, "Deadline must be > 0");

        jobCount++;
        jobs[jobCount] = Job({
            id: jobCount,
            client: msg.sender,
            freelancer: address(0),
            title: title,
            description: description,
            amount: msg.value,
            deadline: block.timestamp + (deadlineDays * 1 days),
            workLink: "",
            revisionNote: "",
            status: Status.Open
        });

        emit JobCreated(jobCount, msg.sender, title, msg.value);
        return jobCount;
    }

    function acceptJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(job.status == Status.Open, "Job not open");
        require(msg.sender != job.client, "Client cannot accept own job");

        job.freelancer = msg.sender;
        job.status = Status.Active;
        job.revisionNote = "";

        emit JobAccepted(jobId, msg.sender);
    }

    function submitWork(uint256 jobId, string calldata workLink)
        external onlyFreelancer(jobId)
    {
        Job storage job = jobs[jobId];
        require(job.status == Status.Active, "Job not active");

        job.workLink = workLink;
        job.revisionNote = "";
        job.status = Status.PendingReview;

        emit WorkSubmitted(jobId, workLink);
    }

    function releasePayment(uint256 jobId) external onlyClient(jobId) {
        Job storage job = jobs[jobId];
        require(job.status == Status.PendingReview, "No work submitted yet");

        job.status = Status.Completed;
        uint256 amount = job.amount;
        address freelancer = job.freelancer;

        (bool sent, ) = freelancer.call{value: amount}("");
        require(sent, "Payment failed");

        emit PaymentReleased(jobId, freelancer, amount);
    }

    function requestRevision(uint256 jobId, string calldata note)
        external onlyClient(jobId)
    {
        Job storage job = jobs[jobId];
        require(job.status == Status.PendingReview, "No work submitted yet");

        job.revisionNote = note;
        job.status = Status.Active;

        emit RevisionRequested(jobId, note);
    }

    function reassignJob(uint256 jobId) external onlyClient(jobId) {
        Job storage job = jobs[jobId];
        require(job.status == Status.PendingReview, "No work submitted yet");

        job.freelancer = address(0);
        job.workLink = "";
        job.revisionNote = "";
        job.status = Status.Open;

        emit JobReassigned(jobId);
    }

    function autoRelease(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(job.status == Status.PendingReview, "No work submitted");
        require(block.timestamp > job.deadline, "Deadline not reached");

        job.status = Status.Completed;
        uint256 amount = job.amount;
        address freelancer = job.freelancer;

        (bool sent, ) = freelancer.call{value: amount}("");
        require(sent, "Payment failed");

        emit PaymentReleased(jobId, freelancer, amount);
    }

    function cancelJob(uint256 jobId) external onlyClient(jobId) {
        Job storage job = jobs[jobId];
        require(job.status == Status.Open, "Can only cancel open jobs");

        job.status = Status.Cancelled;

        (bool sent, ) = job.client.call{value: job.amount}("");
        require(sent, "Refund failed");

        emit JobCancelled(jobId);
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    function getJobsByStatus(Status status) external view returns (Job[] memory) {
        uint256 count = 0;
        for (uint256 i = 1; i <= jobCount; i++) {
            if (jobs[i].status == status) count++;
        }
        Job[] memory result = new Job[](count);
        uint256 idx = 0;
        for (uint256 i = 1; i <= jobCount; i++) {
            if (jobs[i].status == status) result[idx++] = jobs[i];
        }
        return result;
    }
}
