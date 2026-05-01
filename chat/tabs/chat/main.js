import { ref, computed } from "vue";
import {
    useGraffiti,
    useGraffitiSession,
    useGraffitiDiscover,
} from "@graffiti-garden/wrapper-vue";

export default async () => ({
    props: ["chatId"],
    components: {
        ChatMessage: await import(
            new URL("../../../components/chat-message/main.js", import.meta.url)
        ).then((m) => m.default()),
    },
    template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
        r.text(),
    ),
    setup(props) {
        const graffiti = useGraffiti();
        const session = useGraffitiSession();

        const chatChannel = computed(() => [props.chatId]);

        // Messages
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

        // Invite
        // To get the chat title for the invite we discover the chat object
        // from the current user's own actor ID channel.
        const { objects: myChatObjects } = useGraffitiDiscover(
            () => (session.value ? [session.value.actor] : []),
            {
                properties: {
                    value: {
                        required: [
                            "activity",
                            "type",
                            "title",
                            "channel",
                            "published",
                        ],
                        properties: {
                            activity: { type: "string", const: "Create" },
                            type: { type: "string", const: "Chat" },
                            title: { type: "string" },
                            channel: { type: "string" },
                            published: { type: "number" },
                        },
                    },
                },
            },
            session,
            true,
        );

        const chatTitle = computed(() => {
            const match = myChatObjects.value.find(
                (c) => c.value.channel === props.chatId,
            );
            return match ? match.value.title : "this chat";
        });

        const inviteeActor = ref("");
        const isInviting = ref(false);
        const showInviteForm = ref(false);

        const inviteError = ref("");

        async function sendInvite() {
            if (!inviteeActor.value.trim()) return;
            isInviting.value = true;
            inviteError.value = "";
            try {
                // Resolve the handle to a full actor ID (did:plc:...)
                const actorId = await graffiti.handleToActor(
                    inviteeActor.value.trim(),
                );
                await graffiti.post(
                    {
                        value: {
                            activity: "Invite",
                            type: "Chat",
                            title: chatTitle.value,
                            channel: props.chatId,
                            published: Date.now(),
                        },
                        channels: [actorId],
                        allowed: [actorId],
                    },
                    session.value,
                );
                inviteeActor.value = "";
                showInviteForm.value = false;
            } catch (e) {
                inviteError.value =
                    "Could not find that user. Double-check the handle and try again.";
            } finally {
                isInviting.value = false;
            }
        }

        return {
            session,
            sortedMessages,
            messagesLoading,
            myMessage,
            isSendingMessage,
            sendMessage,
            deleteMessage,
            inviteeActor,
            isInviting,
            showInviteForm,
            sendInvite,
            inviteError,
            chatTitle,
        };
    },
});
