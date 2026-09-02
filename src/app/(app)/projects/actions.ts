"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { Priority, ProjectStatus, TaskStatus } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import {
  isPriority,
  isProjectStatus,
  isTaskStatus,
} from "@/lib/project-task";
import {
  getOptionalFormString,
  getRequiredFormString,
  getValidationErrorParam,
} from "@/lib/validation";

function toDateOrNull(value: string | null) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);

  return Number.isNaN(date.getTime()) ? null : date;
}

async function getProfileId() {
  const profile = await prisma.userProfile.findFirst({
    orderBy: { createdAt: "asc" },
    select: { id: true },
  });

  return profile?.id ?? null;
}

function readProjectForm(formData: FormData) {
  const statusValue = formData.get("status");
  const priorityValue = formData.get("priority");
  const clientId = getOptionalFormString(formData, "clientId");

  return {
    clientId,
    description: getOptionalFormString(formData, "description"),
    dueDate: toDateOrNull(getOptionalFormString(formData, "dueDate")),
    name: getRequiredFormString(formData, "name"),
    priority: isPriority(priorityValue) ? priorityValue : Priority.MEDIUM,
    startDate: toDateOrNull(getOptionalFormString(formData, "startDate")),
    status: isProjectStatus(statusValue) ? statusValue : ProjectStatus.ACTIVE,
  };
}

export async function createProject(formData: FormData) {
  let profileId: string | null;

  try {
    profileId = await getProfileId();
  } catch {
    redirect("/projects/new?error=db");
  }

  if (!profileId) {
    redirect("/settings/profile?missingProfile=1");
  }

  let data;

  try {
    data = readProjectForm(formData);
  } catch (error) {
    redirect(`/projects/new?error=${getValidationErrorParam(error)}`);
  }

  let projectId: string;

  try {
    const project = await prisma.project.create({
      data: { ...data, profileId },
      select: { id: true },
    });

    projectId = project.id;
  } catch {
    redirect("/projects/new?error=db");
  }

  revalidatePath("/projects");
  revalidatePath("/tasks");
  redirect(`/projects/${projectId}?saved=1`);
}

export async function updateProject(projectId: string, formData: FormData) {
  let data;

  try {
    data = readProjectForm(formData);
  } catch (error) {
    redirect(`/projects/${projectId}?error=${getValidationErrorParam(error)}`);
  }

  try {
    await prisma.project.update({
      data,
      where: { id: projectId },
    });
  } catch {
    redirect(`/projects/${projectId}?error=db`);
  }

  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/tasks");
  redirect(`/projects/${projectId}?saved=1`);
}

export async function deleteProject(projectId: string) {
  try {
    // Úkoly i jejich poznámky mizí s projektem díky kaskádě ve schématu.
    await prisma.project.delete({ where: { id: projectId } });
  } catch {
    redirect(`/projects/${projectId}?error=delete`);
  }

  revalidatePath("/projects");
  revalidatePath("/tasks");
  redirect("/projects?deleted=1");
}

function readTaskForm(formData: FormData) {
  const statusValue = formData.get("status");
  const priorityValue = formData.get("priority");

  return {
    description: getOptionalFormString(formData, "description"),
    dueDate: toDateOrNull(getOptionalFormString(formData, "dueDate")),
    priority: isPriority(priorityValue) ? priorityValue : Priority.MEDIUM,
    status: isTaskStatus(statusValue) ? statusValue : TaskStatus.TODO,
    title: getRequiredFormString(formData, "title"),
  };
}

/**
 * Nový úkol jde na začátek svého sloupce. Pořadí je vedené v rámci stavu
 * napříč projekty, aby ruční řazení fungovalo i na celkové nástěnce.
 */
async function getNextPosition(status: TaskStatus) {
  const first = await prisma.task.findFirst({
    orderBy: { position: "asc" },
    select: { position: true },
    where: { status },
  });

  return (first?.position ?? 0) - 1;
}

export async function createTask(formData: FormData) {
  const projectId = getOptionalFormString(formData, "projectId");
  const returnTo = getOptionalFormString(formData, "returnTo") ?? "/tasks";

  if (!projectId) {
    redirect(`${returnTo}?error=project`);
  }

  let data;

  try {
    data = readTaskForm(formData);
  } catch (error) {
    redirect(`${returnTo}?error=${getValidationErrorParam(error)}`);
  }

  try {
    await prisma.task.create({
      data: {
        ...data,
        doneAt: data.status === TaskStatus.DONE ? new Date() : null,
        position: await getNextPosition(data.status),
        projectId,
      },
    });
  } catch {
    redirect(`${returnTo}?error=db`);
  }

  revalidatePath("/tasks");
  revalidatePath("/projects");
  revalidatePath(`/projects/${projectId}`);
  redirect(`${returnTo}?taskCreated=1`);
}

export async function updateTask(taskId: string, formData: FormData) {
  let data;

  try {
    data = readTaskForm(formData);
  } catch (error) {
    redirect(`/tasks/${taskId}?error=${getValidationErrorParam(error)}`);
  }

  try {
    const current = await prisma.task.findUnique({
      select: { doneAt: true, status: true },
      where: { id: taskId },
    });

    if (!current) {
      redirect("/tasks?error=notfound");
    }

    await prisma.task.update({
      data: {
        ...data,
        // Datum dokončení nastavíme při přechodu do Hotovo a zrušíme při návratu.
        doneAt:
          data.status === TaskStatus.DONE
            ? (current.doneAt ?? new Date())
            : null,
      },
      where: { id: taskId },
    });
  } catch {
    redirect(`/tasks/${taskId}?error=db`);
  }

  revalidatePath("/tasks");
  revalidatePath("/projects");
  revalidatePath(`/tasks/${taskId}`);
  redirect(`/tasks/${taskId}?saved=1`);
}

export async function deleteTask(taskId: string) {
  let projectId: string | null = null;

  try {
    const task = await prisma.task.findUnique({
      select: { projectId: true },
      where: { id: taskId },
    });

    projectId = task?.projectId ?? null;

    await prisma.task.delete({ where: { id: taskId } });
  } catch {
    redirect(`/tasks/${taskId}?error=delete`);
  }

  revalidatePath("/tasks");
  revalidatePath("/projects");

  if (projectId) {
    revalidatePath(`/projects/${projectId}`);
  }

  redirect("/tasks?taskDeleted=1");
}

/**
 * Přesun úkolu na nástěnce. Voláno z drag & dropu, proto nevrací redirect,
 * ale jen výsledek — stránku si obnoví klient sám.
 */
export async function moveTask(
  taskId: string,
  status: TaskStatus,
  beforeTaskId: string | null,
) {
  if (!isTaskStatus(status)) {
    return { ok: false as const };
  }

  try {
    const task = await prisma.task.findUnique({
      select: { doneAt: true, projectId: true },
      where: { id: taskId },
    });

    if (!task) {
      return { ok: false as const };
    }

    // Pozici odvodíme od sousedů v cílovém sloupci, ať se pořadí zachová.
    // Sloupec bereme napříč projekty, protože stejnou nástěnku ukazuje
    // i celková agenda úkolů, nejen detail projektu.
    const columnTasks = await prisma.task.findMany({
      orderBy: { position: "asc" },
      select: { id: true, position: true },
      where: { status },
    });

    const others = columnTasks.filter((item) => item.id !== taskId);
    const targetIndex = beforeTaskId
      ? others.findIndex((item) => item.id === beforeTaskId)
      : others.length;
    const insertAt = targetIndex === -1 ? others.length : targetIndex;

    const previous = others[insertAt - 1]?.position;
    const next = others[insertAt]?.position;

    let position: number;

    if (previous === undefined && next === undefined) {
      position = 0;
    } else if (previous === undefined) {
      position = next! - 1;
    } else if (next === undefined) {
      position = previous + 1;
    } else if (next - previous > 1) {
      position = Math.floor((previous + next) / 2);
    } else {
      // Mezi sousedy není místo, sloupec přečíslujeme s odstupem.
      const reordered = [
        ...others.slice(0, insertAt),
        { id: taskId, position: 0 },
        ...others.slice(insertAt),
      ];

      await prisma.$transaction(
        reordered.map((item, index) =>
          prisma.task.update({
            data: { position: index * 100 },
            where: { id: item.id },
          }),
        ),
      );

      position = insertAt * 100;
    }

    await prisma.task.update({
      data: {
        doneAt:
          status === TaskStatus.DONE ? (task.doneAt ?? new Date()) : null,
        position,
        status,
      },
      where: { id: taskId },
    });

    revalidatePath("/tasks");
    revalidatePath("/projects");
    revalidatePath(`/projects/${task.projectId}`);

    return { ok: true as const };
  } catch {
    return { ok: false as const };
  }
}

export async function addTaskNote(taskId: string, formData: FormData) {
  const body = getOptionalFormString(formData, "body");

  if (!body) {
    redirect(`/tasks/${taskId}?error=note`);
  }

  try {
    await prisma.taskNote.create({
      data: { body, taskId },
    });
  } catch {
    redirect(`/tasks/${taskId}?error=db`);
  }

  revalidatePath(`/tasks/${taskId}`);
  redirect(`/tasks/${taskId}?noteAdded=1`);
}

export async function deleteTaskNote(noteId: string, taskId: string) {
  try {
    await prisma.taskNote.delete({ where: { id: noteId } });
  } catch {
    redirect(`/tasks/${taskId}?error=db`);
  }

  revalidatePath(`/tasks/${taskId}`);
  redirect(`/tasks/${taskId}?noteDeleted=1`);
}
