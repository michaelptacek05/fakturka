"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";

import { createTask } from "@/app/(app)/projects/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { InputField, SelectField, TextareaField } from "@/components/ui/field";
import { Priority, TaskStatus } from "@/generated/prisma/enums";
import {
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  TASK_BOARD_COLUMNS,
  TASK_STATUS_LABELS,
} from "@/lib/project-task";

export type TaskProjectOption = {
  clientName: string | null;
  id: string;
  name: string;
};

type TaskCreateFormProps = {
  /** Na detailu projektu je projekt daný a výběr se nezobrazuje. */
  fixedProjectId?: string;
  projects: TaskProjectOption[];
  returnTo: string;
};

export function TaskCreateForm({
  fixedProjectId,
  projects,
  returnTo,
}: TaskCreateFormProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (projects.length === 0 && !fixedProjectId) {
    return null;
  }

  if (!isOpen) {
    return (
      <Button type="button" onClick={() => setIsOpen(true)}>
        <Plus className="size-4" aria-hidden="true" />
        Přidat úkol
      </Button>
    );
  }

  return (
    <Card className="w-full">
      <CardContent>
        <form action={createTask} className="space-y-4">
          <input type="hidden" name="returnTo" value={returnTo} />
          {fixedProjectId ? (
            <input type="hidden" name="projectId" value={fixedProjectId} />
          ) : null}

          <div className="flex items-start justify-between gap-4">
            <h3 className="text-sm font-medium">Nový úkol</h3>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Zavřít formulář"
              onClick={() => setIsOpen(false)}
            >
              <X className="size-4" aria-hidden="true" />
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <InputField
              className="md:col-span-2"
              label="Název úkolu"
              name="title"
              required
              autoFocus
              placeholder="Např. Nasadit novou verzi"
            />

            {fixedProjectId ? null : (
              <SelectField
                className="md:col-span-2"
                label="Projekt"
                name="projectId"
                required
              >
                {projects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                    {project.clientName ? ` — ${project.clientName}` : ""}
                  </option>
                ))}
              </SelectField>
            )}

            <SelectField label="Stav" name="status" defaultValue={TaskStatus.TODO}>
              {TASK_BOARD_COLUMNS.map((status) => (
                <option key={status} value={status}>
                  {TASK_STATUS_LABELS[status]}
                </option>
              ))}
            </SelectField>

            <SelectField
              label="Priorita"
              name="priority"
              defaultValue={Priority.MEDIUM}
            >
              {PRIORITY_ORDER.map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </option>
              ))}
            </SelectField>

            <InputField label="Termín" name="dueDate" type="date" />

            <TextareaField
              className="md:col-span-2"
              label="Popis"
              name="description"
              placeholder="Co je potřeba udělat…"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsOpen(false)}
            >
              Zrušit
            </Button>
            <Button type="submit">
              <Plus className="size-4" aria-hidden="true" />
              Vytvořit úkol
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
