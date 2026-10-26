import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

export function formatSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';

    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

    // Determine the appropriate unit by calculating the log
    const i = Math.floor(Math.log(bytes) / Math.log(k));

    // Format with 2 decimal places and round
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

export const generateUUID = () => crypto.randomUUID();
// Dashboard scores use deterministic coverage; legacy AI-only reviews need a rerun.
export const resumeScore = (resume: Resume): number | null => {
    const score = resume.match?.score;
    return typeof score === "number" && Number.isFinite(score) && score >= 0 && score <= 100 ? score : null;
};

export type SortKey = "recent" | "score-desc" | "score-asc" | "company";

export const filterAndSortResumes = (
    resumes: Resume[],
    query: string,
    sort: SortKey,
): Resume[] => {
    const q = query.trim().toLowerCase();
    const filtered = q
        ? resumes.filter((r) =>
            `${r.companyName ?? ""} ${r.jobTitle ?? ""}`.toLowerCase().includes(q),
        )
        : resumes;

    const sorted = [...filtered];

    // Unscored resumes sort last in every order.
    switch (sort) {
        case "score-desc":
            return sorted.sort((a, b) => (resumeScore(b) ?? -1) - (resumeScore(a) ?? -1));
        case "score-asc":
            return sorted.sort((a, b) => (resumeScore(a) ?? 101) - (resumeScore(b) ?? 101));
        case "company":
            return sorted.sort((a, b) =>
                (a.companyName ?? "").localeCompare(b.companyName ?? ""),
            );
        case "recent":
            return sorted.sort((a, b) =>
                (b.createdAt ?? "").localeCompare(a.createdAt ?? ""),
            );
    }
};

export const resumeStats = (resumes: Resume[]) => {
    if (!resumes.length) return null;

    const scores = resumes
        .map(resumeScore)
        .filter((score): score is number => score !== null);

    return {
        total: resumes.length,
        average: scores.length
            ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
            : null,
        best: scores.length ? Math.max(...scores) : null,
    };
};
