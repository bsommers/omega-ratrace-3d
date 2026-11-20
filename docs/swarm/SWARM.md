# Swarm manifest — <project>

Single source of truth for the agent swarm. `node <tracker>/bin/swarm-plan.mjs` turns this file into
`docs/swarm/prompts/<id>.md` (preamble + task + role appendix) and `.tracker/plan.json`.
Agent header: `## id | model | phase | role | Name`, then an `owns:` line, then the task.
Spawn each agent with: "Read {{root}}/docs/swarm/prompts/<id>.md and execute it exactly."

## @meta
project: My Project
tagline: One line about what is being built

## @preamble
You are subagent `{{id}}` ({{name}}) in a parallel swarm building **<project>** in `{{root}}`. Model tier: {{model}}.

Rules:
1. `ARCHITECTURE.md` (and any shared definitions file) is the binding contract. Read only what your task needs: list the
   sections (`grep -n '^## ' ARCHITECTURE.md`), Read those with offset/limit, grep shared files instead of reading them whole.
2. You own ONLY: {{owns}}. Besides those you may write your tests under `test/`, your report, and scratch output.
   Other agents are writing other modules **right now**: their files may be missing or half-written. Code against the
   contract, guard with fallbacks, never edit a file you do not own; list what you need under "Requests" in your report.
3. Progress reporting (drives a live dashboard): first `node <tracker>/bin/track.mjs {{id}} start "<plan in a few words>"`;
   then `track.mjs {{id}} progress <pct> "<what just landed>"` at 4 or more milestones; finally
   `track.mjs {{id}} done "<one-line result>"` (or `blocked` / `failed` with the reason). Run from {{root}} or set TRACKER_ROOT.
4. Verify for real before claiming done: run it, test it, look at it. Report failures honestly.
5. If you must wait for another agent's file, poll (`for i in $(seq 90); do [ -f <path> ] && break; sleep 10; done`),
   then proceed with a fallback if it still is not there.
6. Finish by writing `docs/swarm/reports/{{id}}.md` with sections: **What I built** · **Verification evidence** ·
   **Deviations from the contract** · **Mistakes I made and how I fixed them** · **Learnings for a future agent** ·
   **Requests for other modules**. Report shared-library defects here too, do not only work around them.
7. Keep chat output minimal (status lines only). Final reply: 8 lines max.
8. Save work to disk early and often; the swarm can be interrupted by usage limits. If your owned files already exist,
   you are RESUMING: inspect them and continue instead of starting over.
9. Install no new dependencies. No git commands unless told. Never kill processes you did not start.
10. Context budget — your whole context is re-sent on every tool call, so keep it small: read files with offset/limit
    or grep, never whole large files; pipe command output through `tail`/`grep` (40 lines max); look at an image only
    when you will act on it (about 6 in total; prefer numeric checks); never re-read a file you just wrote.
11. Checkpoints — keep `docs/swarm/progress/{{id}}.md` (30 lines max: **Done** · **Next steps, in order** ·
    **Gotchas** · **Commands to verify**) and update it at every milestone. If it exists when you start, you are a fresh
    agent continuing the job: read it first, trust it, do not re-derive. After about 25 tool calls, or at a milestone with
    substantial work left, update the checkpoint and END your turn with a last line `CONTINUE: <next step>`. Only write
    the report and call `track.mjs ... done` when the whole task is finished.
12. Stamp times with `date -u`; never type a timestamp.

Your task:

## @role:example
Role appendix: text added to the end of every prompt whose agent has role `example`. Delete if unused.

## hello | sonnet | p1 | example | Hello module
owns: src/hello.js, test/hello.test.js
Write `src/hello.js` exporting `hello(name)` per the contract, with a test.
