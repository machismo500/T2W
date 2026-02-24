import { HeroSection } from "@/components/home/HeroSection";
import { UpcomingRides } from "@/components/home/UpcomingRides";
import { NotificationBoard } from "@/components/home/NotificationBoard";
import { AboutContact } from "@/components/home/AboutContact";

export default function Home() {
  return (
    <>
      <HeroSection />
      <UpcomingRides />
      <NotificationBoard />
      <AboutContact />
    </>
  );
}
