export default async () => ({
    props: ["invite"],
    emits: ["accept", "decline"],
    template: await fetch(new URL("./index.html", import.meta.url)).then((r) =>
        r.text(),
    ),
    setup() {
        return {};
    },
});
