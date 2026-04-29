import { ref, computed } from "vue";
import {
    useGraffiti,
    useGraffitiSession,
    useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";

export default async () => ({
    props: ["chatId"],
    template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
        r.text(),
    ),
    setup(props) {
        const graffiti = useGraffiti();
        const session = useGraffitiSession();

        const chatChannel = computed(() => [props.chatId]);

        const { objects: taskObjects, isFirstPoll: tasksLoading } =
            useGraffitiDiscover(
                chatChannel,
                {
                    properties: {
                        value: {
                            required: [
                                "type",
                                "title",
                                "deadline",
                                "assignees",
                                "status",
                                "published",
                            ],
                            properties: {
                                type: { type: "string", const: "Task" },
                                title: { type: "string" },
                                deadline: { type: "string" },
                                assignees: { type: "array" },
                                status: { type: "string" },
                                published: { type: "number" },
                            },
                        },
                    },
                },
                undefined,
                true,
            );

        const sortedTasks = computed(() =>
            taskObjects.value.toSorted(
                (a, b) => a.value.published - b.value.published,
            ),
        );

        const showTaskForm = ref(false);
        const newTask = ref({
            title: "",
            deadline: "",
            assignees: "",
            description: "",
        });
        const isCreatingTask = ref(false);
        const createTaskLabel = computed(() =>
            isCreatingTask.value ? "Creating..." : "Create Task",
        );

        async function createTask() {
            if (!newTask.value.title.trim() || !newTask.value.deadline) return;
            isCreatingTask.value = true;
            try {
                const assigneeList = newTask.value.assignees
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                await graffiti.post(
                    {
                        value: {
                            type: "Task",
                            title: newTask.value.title.trim(),
                            deadline: newTask.value.deadline,
                            assignees: assigneeList,
                            status: "Not Started",
                            description: newTask.value.description.trim(),
                            published: Date.now(),
                        },
                        channels: [props.chatId],
                    },
                    session.value,
                );
                newTask.value = {
                    title: "",
                    deadline: "",
                    assignees: "",
                    description: "",
                };
                showTaskForm.value = false;
            } finally {
                isCreatingTask.value = false;
            }
        }

        async function updateTaskStatus(task, newStatus) {
            const updated = { ...task.value, status: newStatus };
            await graffiti.delete(task, session.value);
            await graffiti.post(
                { value: updated, channels: [props.chatId] },
                session.value,
            );
        }

        function joinAssignees(assignees) {
            return assignees.join(", ") || "None";
        }

        function getDescription(description) {
            return description || "No additional description";
        }

        return {
            session,
            sortedTasks,
            tasksLoading,
            showTaskForm,
            newTask,
            isCreatingTask,
            createTaskLabel,
            createTask,
            updateTaskStatus,
            joinAssignees,
            getDescription,
        };
    },
});
