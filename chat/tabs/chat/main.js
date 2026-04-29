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

        const { objects: messageObjects, isFirstPoll: messagesLoading } =
            useGraffitiDiscover(
                chatChannel,
                {
                    properties: {
                        value: {
                            required: ["type", "content", "published"],
                            properties: {
                                type: { type: "string", const: "Message" },
                                content: { type: "string" },
                                published: { type: "number" },
                            },
                        },
                    },
                },
                undefined,
                true,
            );

        const sortedMessages = computed(() =>
            messageObjects.value.toSorted(
                (a, b) => a.value.published - b.value.published,
            ),
        );

        const myMessage = ref("");
        const isSendingMessage = ref(false);

        async function sendMessage() {
            if (!myMessage.value.trim()) return;
            isSendingMessage.value = true;
            try {
                await graffiti.post(
                    {
                        value: {
                            type: "Message",
                            content: myMessage.value.trim(),
                            published: Date.now(),
                        },
                        channels: [props.chatId],
                    },
                    session.value,
                );
                myMessage.value = "";
            } finally {
                isSendingMessage.value = false;
            }
        }

        async function deleteMessage(message) {
            await graffiti.delete(message, session.value);
        }

        return {
            session,
            sortedMessages,
            messagesLoading,
            myMessage,
            isSendingMessage,
            sendMessage,
            deleteMessage,
        };
    },
});
