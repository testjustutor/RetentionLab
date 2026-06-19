---
name: create-skill
user-invocable: true
description: "Create or update a workspace `SKILL.md` for VS Code agent customization by following a clear, repeatable workflow."
---

# Create Skill

## Purpose

Guide the authoring of a workspace-scoped `SKILL.md` file for VS Code agent customization. This skill captures the workflow, decision logic, and quality checks needed to make a reusable skill.

## Create a project

How to use projects
Projects help organize your work and leverage knowledge across multiple conversations. Upload docs, code, and files to create themed collections that Claude can reference again and again.

Start by creating a memorable title and description to organize your project. You can always edit it later.

What are you working on?
What are you trying to achieve?

## Use When

- you want to define a new agent customization workflow in the repo
- you need to map a multi-step process into a skill file
- you want a repeatable checklist for creating `SKILL.md`

## Workflow

1. Determine the intended outcome.
   - What should the skill produce?
   - Who will use it: project team or only you?
   - Is the skill a quick checklist or a full multi-step workflow?

2. Choose the proper scope.
   - Workspace-scoped skills belong in `.github/skills/<name>/SKILL.md`
   - Skills are not stored in the user prompts folder.

3. Draft the skill.
   - Add YAML frontmatter with `name`, `user-invocable`, and a descriptive `description`.
   - Use `description` keywords that match likely trigger phrases.
   - Write a clear body that explains the process, decision points, and quality criteria.

4. Validate the skill.
   - Confirm the file path and folder name match the skill name.
   - Verify YAML frontmatter is valid and uses spaces.
   - Ensure the description is actionable and search-friendly.
   - Add example prompts or usage notes if needed.

## Quality Checklist

- [ ] `name` matches the folder name and is unique
- [ ] `description` clearly states when to use the skill
- [ ] workflow steps are explicit and sequential
- [ ] completion/validation criteria are provided
- [ ] the skill is workspace-scoped and stored under `.github/skills/`

## Example Prompts

- "Create a new `SKILL.md` for a repo workflow that reviews pull requests."
- "Help me draft a skill to generate database migration scripts with validation."
- "Write a skill template for onboarding new project contributors."

## Notes

- Prefer workspace-level customizations for skills.
- For single-file guidance or one-off tasks, consider prompts or file instructions instead of a full skill.
