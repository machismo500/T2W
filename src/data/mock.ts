import { Ride, BlogPost, Notification, User, Guideline, RidePost } from "@/types";
import { pastRides } from "./past-rides";

// ── All rides (past + upcoming) ──
export const mockUpcomingRides: Ride[] = [
  {
    id: "ride-upcoming-028",
    title: "Anniversary Ride",
    rideNumber: "#028",
    type: "weekend",
    status: "upcoming",
    startDate: "2026-03-21",
    endDate: "2026-03-22",
    startLocation: "Bangalore, Karnataka",
    endLocation: "Sakleshpur",
    route: ["Bangalore, Karnataka", "Sakleshpur"],
    distanceKm: 460,
    maxRiders: 50,
    registeredRiders: 0,
    difficulty: "moderate",
    description:
      "T2W Ride #028 - Anniversary Ride. Celebrating 2 years of brotherhood on two wheels!",
    highlights: [
      "2nd Anniversary celebration",
      "DJ and Party",
      "Goodies",
      "Group celebration dinner",
    ],
    fee: 0,
    leadRider: "Shankar VK",
    sweepRider: "Jay Trivedi",
    organisedBy: "Jay Trivedi",
    accountsBy: "Roshan Manuel",
    meetupTime: "05:30",
    rideStartTime: "06:00",
    startingPoint: "Parle-G Toll",
  },
];

// Combine past and upcoming into a single array
export const mockRides: Ride[] = [...pastRides, ...mockUpcomingRides];

export const mockBlogs: BlogPost[] = [
  {
    id: "blog-1",
    title: "Himalayan Tales: 19 Days from Manali to Leh",
    excerpt:
      "The T2W Himalayan expedition - 3,300 km through the highest motorable passes in the world. A ride that changed everything.",
    content:
      "It started at 2:30 AM at Bangalore International Airport. 19 days, 3,300 km, and some of the most breathtaking landscapes on Earth. From Rohtang to Khardung La, through Pangong Lake and Nubra Valley - this is the story of T2W Ride #004, Himalayan Tales. Organised by Roshan Manuel with Suren as pilot and Harish Mysuru on sweep, this expedition tested every rider to their limits and beyond.",
    authorName: "Roshan Manuel",
    authorId: "admin-1",
    publishDate: "2024-07-15",
    tags: ["himalayan", "expedition", "ladakh", "adventure"],
    type: "official",
    isVlog: false,
    readTime: 15,
    likes: 356,
    approvalStatus: "approved",
    approvedBy: "admin-1",
  },
  {
    id: "blog-2",
    title: "Nepal Tales: Riding Through the Himalayas",
    excerpt:
      "1,950 km across Nepal - from Kathmandu to Pokhara and beyond. T2W's first international expedition.",
    content:
      "T2W Ride #016 took us across the border into Nepal for 18 incredible days. Starting May 1st 2025, we rode through Kathmandu valley, the Annapurna circuit roads, Pokhara's lakeside, and the winding mountain passes of the Himalayas. An international expedition that pushed boundaries and created memories for a lifetime.",
    authorName: "Roshan Manuel",
    authorId: "admin-1",
    publishDate: "2025-06-01",
    tags: ["nepal", "expedition", "international", "adventure"],
    type: "personal",
    isVlog: false,
    readTime: 12,
    likes: 289,
    approvalStatus: "approved",
    approvedBy: "admin-1",
  },
  {
    id: "blog-3",
    title: "Tales of Thailand: T2W Goes International Again",
    excerpt:
      "1,200 km through the Land of Smiles. From Bangkok to Chiang Mai on two wheels.",
    content:
      "After Nepal, T2W set its sights on Southeast Asia. Ride #023 - Tales of Thailand 2025, spanning October 31 to November 10, covered 1,200 km from Bangkok to Chiang Mai. Organised by Roshan Manuel, this expedition explored Thai temples, mountain roads, and street food culture on two wheels.",
    authorName: "Jay Trivedi",
    authorId: "admin-3",
    publishDate: "2025-11-20",
    tags: ["thailand", "expedition", "international"],
    type: "personal",
    isVlog: false,
    readTime: 10,
    likes: 245,
    approvalStatus: "approved",
    approvedBy: "admin-1",
  },
  {
    id: "blog-4",
    title: "Kambala 3.0: The Mangalore Run",
    excerpt:
      "800 km, 3 days, and the thrill of witnessing the ancient Kambala buffalo race in coastal Karnataka.",
    content:
      "T2W Ride #013 - Kambala 3.0 was a special one. Organised by Jay Trivedi, this 3-day ride from Bangalore to Mangalore covered 800 km and timed perfectly with the traditional Kambala buffalo race. Starting from Parle-G Toll at 5 AM with Jay as pilot and Harish Mysuru on sweep, we experienced the best of coastal Karnataka.",
    authorName: "Harish Mysuru",
    authorId: "admin-5",
    publishDate: "2025-03-01",
    tags: ["coastal", "kambala", "mangalore", "culture"],
    type: "personal",
    isVlog: false,
    readTime: 8,
    likes: 198,
    approvalStatus: "approved",
    approvedBy: "admin-1",
  },
  {
    id: "blog-5",
    title: "Top 10 T2W Rides: Our Greatest Hits So Far",
    excerpt:
      "From The Beginning (#001) to Kavvayi Island (#027) - looking back at 27 rides and counting.",
    content:
      "Two years, 27 rides, 140 riders, and thousands of kilometres. From our very first ride to Sakleshpur in March 2024 to the serene backwaters of Kavvayi Island in February 2026 - here's our definitive guide to the top 10 T2W rides that defined our brotherhood on two wheels.",
    authorName: "Shreyas BM",
    authorId: "admin-4",
    publishDate: "2026-02-25",
    tags: ["bangalore", "routes", "guide", "best-of", "karnataka"],
    type: "official",
    isVlog: false,
    readTime: 10,
    likes: 412,
    approvalStatus: "approved",
    approvedBy: "admin-1",
  },
];

export const mockRidePosts: RidePost[] = [];

export const mockNotifications: Notification[] = [
  {
    id: "notif-1",
    title: "Ride #028 - Anniversary Ride Announced!",
    message:
      "T2W Anniversary Ride on March 21-22, 2026! Meet at Parle-G Toll at 05:30. Organised by Jay Trivedi.",
    type: "ride",
    date: "2026-02-28",
    isRead: false,
  },
  {
    id: "notif-2",
    title: "Ride #027 - Kavvayi Island Completed!",
    message:
      "20 riders completed the 800 km ride to Kavvayi Island. Check out the ride details and photos!",
    type: "success",
    date: "2026-02-22",
    isRead: false,
  },
  {
    id: "notif-3",
    title: "Ride #026 - Ride to Coast 10 Completed!",
    message:
      "1,200 km to Mangalore and back! 28 riders made the journey. View ride details now.",
    type: "success",
    date: "2026-01-26",
    isRead: true,
  },
  {
    id: "notif-4",
    title: "T2W Completes 27 Rides!",
    message:
      "From The Beginning (#001) to Kavvayi Island (#027) - 152 riders and counting. What a journey!",
    type: "info",
    date: "2026-02-23",
    isRead: false,
  },
  {
    id: "notif-5",
    title: "Rider Profiles Now Live!",
    message:
      "View your ride history, total kilometres, and achievements on your rider profile page.",
    type: "info",
    date: "2026-02-27",
    isRead: false,
  },
];

export const mockCurrentUser: User = {
  id: "admin-1",
  name: "Roshan Manuel",
  email: "roshan.manuel@gmail.com",
  phone: "+91 9880141543",
  role: "superadmin",
  joinDate: "2024-03-16",
  isApproved: true,
  motorcycles: [],
  badges: [
    {
      tier: "CONQUEROR",
      name: "Conqueror",
      description: "Founding member and ride organiser",
      minKm: 20000,
      icon: "crown",
      color: "#FF6B35",
      earnedDate: "2024-03-16",
    },
  ],
  totalKm: 0,
  ridesCompleted: 27,
};

export const mockGuidelines: Guideline[] = [
  {
    id: "guide-1",
    title: "Pre-Ride Briefing",
    content:
      "Every T2W ride begins with a mandatory pre-ride briefing. This includes route overview, fuel stop planning, emergency protocols, hand signals review, and rider pairing assignments. Arrive at least 30 minutes before the scheduled departure time.",
    category: "group",
    icon: "clipboard",
  },
  {
    id: "guide-2",
    title: "Formation Riding",
    content:
      "T2W follows staggered formation on highways and single file on mountain roads. Maintain a 2-second gap from the rider directly ahead. The lead rider sets the pace; never overtake the lead rider. The sweep rider stays at the back at all times.",
    category: "group",
    icon: "users",
  },
  {
    id: "guide-3",
    title: "Hand Signals",
    content:
      "All T2W riders must know the standard hand signals: left turn (left arm extended), right turn (left arm bent up at 90 degrees), slow down (left arm extended down, palm facing back), stop (left arm bent down at 90 degrees), hazard on road (pointing to the ground), and single file (left index finger raised).",
    category: "group",
    icon: "hand",
  },
  {
    id: "guide-4",
    title: "Mandatory Safety Gear",
    content:
      "All riders must wear: ISI/ECE certified full-face helmet, riding jacket with armor, riding gloves, riding boots that cover ankles, and riding pants. Hi-visibility vests are recommended for dawn/dusk rides. Non-compliance will result in exclusion from the ride.",
    category: "safety",
    icon: "shield",
  },
  {
    id: "guide-5",
    title: "Bike Preparation",
    content:
      "Before every ride, perform T-CLOCS check: Tires & Wheels (pressure, tread), Controls (levers, cables, throttle), Lights & Electrics (headlight, tail, indicators), Oil & Fluids (engine oil, coolant, brake fluid), Chassis (frame, suspension), and Stands (side stand, center stand).",
    category: "maintenance",
    icon: "wrench",
  },
  {
    id: "guide-6",
    title: "Cornering Techniques",
    content:
      "Slow in, fast out. Reduce speed before entering a corner, not during. Look through the corner to where you want to go. Lean the bike, not your body, for better control. Avoid braking mid-corner. Gradually roll on throttle as you exit the turn.",
    category: "general",
    icon: "navigation",
  },
  {
    id: "guide-7",
    title: "Emergency Protocol",
    content:
      "In case of breakdown or accident: Pull over safely to the shoulder. Turn on hazard lights. Place a warning triangle 50m behind the bike. Inform the sweep rider immediately. Do not attempt to move an injured rider. Call emergency services if needed. The sweep rider carries a first-aid kit.",
    category: "safety",
    icon: "alert-triangle",
  },
  {
    id: "guide-8",
    title: "Fuel Management",
    content:
      "Always start a ride with a full tank. Know your bike's range and plan fuel stops accordingly. The ride leader will announce fuel stops. If you notice your fuel is running low, signal the group to stop. Carry a 1-liter emergency fuel reserve on long rides.",
    category: "general",
    icon: "fuel",
  },
];

// ── Admin / Dashboard mock data ──

export const mockPendingUsers: Array<{
  id: string;
  name: string;
  email: string;
  phone: string;
  city: string;
  ridingExperience: string;
  motorcycles: Array<{ make: string; model: string }>;
  createdAt: string;
}> = [];

export const mockAllUsers = [
  {
    id: "admin-1",
    name: "Roshan Manuel",
    email: "roshan.manuel@gmail.com",
    role: "superadmin",
    isApproved: true,
    joinDate: "2024-03-16",
  },
  {
    id: "admin-6",
    name: "T2W Official",
    email: "taleson2wheels.official@gmail.com",
    role: "superadmin",
    isApproved: true,
    joinDate: "2024-03-16",
  },
  {
    id: "admin-2",
    name: "Sanjeev Kumar",
    email: "san.nh007@gmail.com",
    role: "t2w_rider",
    isApproved: true,
    joinDate: "2024-03-16",
  },
  {
    id: "admin-3",
    name: "Jay Trivedi",
    email: "jaytrivedi.b@gmail.com",
    role: "t2w_rider",
    isApproved: true,
    joinDate: "2024-03-16",
  },
  {
    id: "admin-4",
    name: "Shreyas BM",
    email: "shreyasbm77@gmail.com",
    role: "t2w_rider",
    isApproved: true,
    joinDate: "2024-03-16",
  },
  {
    id: "admin-5",
    name: "Harish Mysuru",
    email: "harishkumarmr27@gmail.com",
    role: "t2w_rider",
    isApproved: true,
    joinDate: "2024-03-16",
  },
];

export const mockContentItems = [
  {
    id: "content-1",
    title: "T2W Brand Guidelines",
    type: "Brand",
    status: "published",
    lastUpdated: "2026-01-15",
  },
  {
    id: "content-2",
    title: "Ride Photography Collection 2025",
    type: "Media",
    status: "published",
    lastUpdated: "2026-02-01",
  },
  {
    id: "content-3",
    title: "Indemnity Form Template",
    type: "Document",
    status: "published",
    lastUpdated: "2025-12-20",
  },
  {
    id: "content-4",
    title: "Social Media Content Calendar",
    type: "Document",
    status: "draft",
    lastUpdated: "2026-02-20",
  },
];
