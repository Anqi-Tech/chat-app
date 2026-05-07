import { ref } from "vue";

export default async () => ({
    props: ["invite"],
    emits: ["accept", "decline"],

    template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
        r.text(),
    ),

    setup(props, { emit }) {
        const visible = ref(true);

        function handleAccept() {
            visible.value = false;

            setTimeout(() => {
                emit("accept", props.invite);
            }, 250);
        }

        function handleDecline() {
            visible.value = false;

            setTimeout(() => {
                emit("decline", props.invite);
            }, 250);
        }

        return {
            visible,
            handleAccept,
            handleDecline,
        };
    },
});
