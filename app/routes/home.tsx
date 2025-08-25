import type { Route } from "./+types/home";
import { Dashboard } from "../panel/panel";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Griffin-Guard-Dashboard" },
    { name: "description", content: "Welcome to Griffin-Guard!" },
  ];
}

export default function Home() {
  return <Dashboard />;
}
