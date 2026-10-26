type ResumeStatus = "analyzing" | "ready" | "failed";

interface Resume {
    id: string;
    companyName?: string;
    jobTitle?: string;
    jobDescription?: string;
    imagePath: string;
    resumePath: string;
    createdAt?: string;
    status?: ResumeStatus;
    error?: string;
    feedback?: Feedback;
    match?: import("../app/lib/matching").MatchResult;
    pageCount?: number;
    warnings?: string[];
    fileName?: string;
}

type Feedback = import("../app/lib/feedback.schema").FeedbackResult;
