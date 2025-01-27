import { z } from "zod";

export const SearchAllPrsParams = z.object({
  question: z.string(),
});
export type SearchAllPrsParams = z.infer<typeof SearchAllPrsParams>;

export const SearchPrsByRepoNameParams = z.object({
  question: z.string(),
  repoName: z.string(),
  range: z
    .number({
      description: "the number of days in the past to look back for data",
    })
    .lte(90, "can only look back 90 days or less"),
});
export type SearchPrsByRepoNameParams = z.infer<typeof SearchPrsByRepoNameParams>;

export const SearchPrsByAuthorParams = z.object({
  question: z.string(),
  author: z.string(),
});
export type SearchPrsByAuthorParams = z.infer<typeof SearchPrsByAuthorParams>;

export const SearchPrsByRepoNameAndAuthorParams = z.object({
  question: z.string(),
  repoName: z.string(),
  author: z.string(),
});
export type SearchPrsByRepoNameAndAuthorParams = z.infer<typeof SearchPrsByRepoNameAndAuthorParams>;

// pull request agent params

export const PullRequestAgentParams = z.object({
  prompt: z.string(),
});
export type PullRequestAgentParams = z.infer<typeof PullRequestAgentParams>;
