import { Ride, BlogPost, Notification, User, Guideline } from "@/types";
import { pastRides } from "./past-rides";

// ── All rides (past + upcoming) ──
export const mockUpcomingRides: Ride[] = [
  {
    id: "ride-upcoming-1",
    title: "Anniversary Ride",
    rideNumber: "#028",
    type: "weekend",
    status: "upcoming",
    startDate: "2026-03-14",
    endDate: "2026-03-15",
    startLocation: "Bangalore, Karnataka",
    endLocation: "Goa",
    route: ["Bangalore", "Goa"],
    distanceKm: 560,
    maxRiders: 50,
    registeredRiders: 1,
    difficulty: "moderate",
    description:
      "T2W Anniversary Ride - Celebrating 2 years of brotherhood on two wheels! Join us for this special ride to Goa.",
    highlights: [
      "2nd Anniversary celebration",
      "Coastal highway",
      "Beach camping",
      "Group celebration dinner",
    ],
    fee: 5000,
    leadRider: "Roshan",
    sweepRider: "Imran",
  },
];

// Combine past and upcoming into a single array
export const mockRides: Ride[] = [...pastRides, ...mockUpcomingRides];

export const mockBlogs: BlogPost[] = [
  {
    id: "blog-1",
    title: "The Art of Cornering: Mastering Twisty Mountain Roads",
    excerpt:
      "Learn the techniques that separate confident riders from cautious ones on challenging mountain roads. From body positioning to throttle control.",
    content:
      "Cornering is where the magic happens on a motorcycle. Whether you're carving through the Western Ghats hairpins or navigating the 36 bends to Ooty, proper technique makes the difference between a white-knuckle experience and pure flow state. In this guide, we break down body positioning, throttle control, line selection, and the all-important concept of 'slow in, fast out' that every T2W rider lives by.",
    author: "Arjun Mehta",
    publishDate: "2026-02-10",
    tags: ["riding-tips", "technique", "mountains"],
    type: "official",
    isVlog: false,
    readTime: 8,
    likes: 142,
  },
  {
    id: "blog-2",
    title: "Spiti Diaries: 10 Days Above the Clouds",
    excerpt:
      "A rider's personal account of the T2W Spiti Valley Expedition. From altitude sickness to soul-stirring sunrises at 15,000 feet.",
    content:
      "Day 1 started with nervous excitement as 15 riders gathered in Manali's Mall Road. By Day 3, crossing Kunzum Pass at 15,000 feet, the altitude hit hard. But nothing prepared us for the ethereal beauty of Chandratal Lake at dawn - a turquoise mirror reflecting snow-capped peaks. This is my personal account of the most transformative motorcycle journey of my life.",
    author: "Priya Sharma",
    publishDate: "2026-01-28",
    tags: ["travel", "spiti", "expedition", "adventure"],
    type: "personal",
    isVlog: false,
    readTime: 12,
    likes: 289,
  },
  {
    id: "blog-3",
    title: "Gear Guide 2026: Essential Riding Equipment for Indian Roads",
    excerpt:
      "Our comprehensive guide to the best riding gear available in India. From helmets to boots, we cover everything you need for a safe ride.",
    content:
      "Riding gear in India has evolved massively. From the days of wearing just a half-face helmet, Indian riders now have access to world-class gear from brands like Rynox, Royal Enfield, Viaterra, and Solace. In this comprehensive guide, we review the best helmets (ISI & ECE certified), jackets, gloves, boots, and pants available in 2026, with options for every budget from Rs. 5,000 to Rs. 50,000.",
    author: "T2W Team",
    publishDate: "2026-02-15",
    tags: ["gear", "safety", "guide"],
    type: "official",
    isVlog: false,
    readTime: 15,
    likes: 356,
  },
  {
    id: "blog-4",
    title: "Night Riding: Tips for Safe After-Dark Adventures",
    excerpt:
      "Night riding can be magical but dangerous. Here are essential tips from our veteran riders on staying safe while enjoying the moonlit roads.",
    content:
      "There's something special about riding under a canopy of stars on an empty highway. But night riding demands extra caution. In this video, Vikram Singh shares his 10 years of night riding experience - from headlight upgrades to reflective gear, fatigue management, and the best night routes around Bangalore and Mumbai.",
    author: "Vikram Singh",
    publishDate: "2026-01-15",
    tags: ["safety", "tips", "night-riding"],
    type: "official",
    isVlog: true,
    videoUrl: "https://youtube.com/watch?v=example",
    readTime: 6,
    likes: 198,
  },
  {
    id: "blog-5",
    title: "My First T2W Ride: A Newbie's Experience",
    excerpt:
      "I was nervous, excited, and everything in between. Here's what my first group ride with Tales on 2 Wheels was really like.",
    content:
      "I'd been riding solo for 2 years before I found T2W on Instagram. The idea of riding in a group of 25 strangers terrified me. But from the moment I arrived at the meeting point on Brigade Road, Bangalore, I knew this was different. The pre-ride briefing was thorough, the formation riding was disciplined, and by the time we stopped for chai at Ramnagara, I'd made 5 new friends who I now ride with every weekend.",
    author: "Sneha Kulkarni",
    publishDate: "2026-02-01",
    tags: ["experience", "first-ride", "community", "bangalore"],
    type: "personal",
    isVlog: false,
    readTime: 5,
    likes: 175,
  },
  {
    id: "blog-6",
    title: "Top 10 Motorcycle Rides Near Bangalore for Weekend Getaways",
    excerpt:
      "Bangalore is a biker's paradise with incredible rides in every direction. Here are the 10 best routes for a weekend escape from the city.",
    content:
      "Living in Bangalore means you're within striking distance of some of India's most spectacular riding roads. From the twisties of Coorg to the plains of Hampi, the ghats of Chikmagalur to the coastal roads of Mangalore - here's our definitive guide to the 10 best motorcycle rides from Bangalore, complete with distance, difficulty, best season, and T2W's insider tips for each route.",
    author: "Arjun Mehta",
    publishDate: "2026-02-20",
    tags: [
      "bangalore",
      "routes",
      "guide",
      "weekend-rides",
      "karnataka",
    ],
    type: "official",
    isVlog: false,
    readTime: 10,
    likes: 412,
  },
  {
    id: "blog-7",
    title: "Royal Enfield vs KTM: Which Adventure Bike for Indian Touring?",
    excerpt:
      "The age-old debate settled by riders who've done 50,000+ km on both. Real-world comparison for Indian touring conditions.",
    content:
      "We put the Royal Enfield Himalayan 450 head-to-head with the KTM 390 Adventure across 5,000 km of Indian roads - from Bangalore to Ladakh and back. Comfort, reliability, fuel efficiency, luggage capacity, off-road capability, and service network - we score every category based on real-world touring experience, not showroom specs.",
    author: "Vikram Singh",
    publishDate: "2026-02-25",
    tags: ["bikes", "review", "comparison", "royal-enfield", "ktm"],
    type: "official",
    isVlog: true,
    videoUrl: "https://youtube.com/watch?v=example2",
    readTime: 14,
    likes: 523,
  },
];

export const mockNotifications: Notification[] = [
  {
    id: "notif-1",
    title: "Coastal Sunrise Sprint - Registration Open!",
    message:
      "Only 12 spots remaining for the Mumbai to Alibaug day ride on March 15th. Register now!",
    type: "ride",
    date: "2026-02-22",
    isRead: false,
  },
  {
    id: "notif-2",
    title: "New Blog Post Published",
    message:
      "Check out our latest gear guide for 2026. Updated recommendations from veteran riders.",
    type: "info",
    date: "2026-02-15",
    isRead: false,
  },
  {
    id: "notif-3",
    title: "Western Ghats Explorer - Almost Full!",
    message:
      "Only 3 spots left for the Western Ghats weekend ride in April. Don't miss out!",
    type: "warning",
    date: "2026-02-20",
    isRead: false,
  },
  {
    id: "notif-4",
    title: "Ride Photos Uploaded",
    message:
      "Photos from the Konkan Coast Cruise are now available in the gallery. Tag yourself!",
    type: "success",
    date: "2026-02-18",
    isRead: true,
  },
  {
    id: "notif-5",
    title: "Nandi Hills Dawn Blaster - New Ride!",
    message:
      "A brand new early morning ride from Bangalore to Nandi Hills on March 22. Limited to 40 riders!",
    type: "ride",
    date: "2026-02-25",
    isRead: false,
  },
  {
    id: "notif-6",
    title: "Bangalore Chapter Launched!",
    message:
      "T2W officially launches its Bangalore chapter. Weekly rides from Brigade Road every Saturday at 6 AM.",
    type: "success",
    date: "2026-02-27",
    isRead: false,
  },
];

export const mockCurrentUser: User = {
  id: "user-1",
  name: "Rohan Kapoor",
  email: "rohan@example.com",
  phone: "+91 98765 43210",
  role: "rider",
  joinDate: "2024-06-15",
  isApproved: true,
  motorcycles: [
    {
      id: "moto-1",
      make: "Royal Enfield",
      model: "Himalayan 450",
      year: 2025,
      cc: 450,
      color: "Slate Himalayan Salt",
      nickname: "Storm",
    },
    {
      id: "moto-2",
      make: "KTM",
      model: "390 Adventure",
      year: 2024,
      cc: 373,
      color: "Orange",
      nickname: "Blaze",
    },
  ],
  badges: [
    {
      tier: "SILVER",
      name: "Silver Rider",
      description: "Completed 1,000 km with T2W",
      minKm: 1000,
      icon: "shield",
      color: "#C0C0C0",
      earnedDate: "2024-09-20",
    },
    {
      tier: "GOLD",
      name: "Gold Rider",
      description: "Completed 5,000 km with T2W",
      minKm: 5000,
      icon: "award",
      color: "#FFD700",
      earnedDate: "2025-05-15",
    },
  ],
  totalKm: 8450,
  ridesCompleted: 12,
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

export const mockPendingUsers = [
  {
    id: "pending-1",
    name: "Aditya Verma",
    email: "aditya.v@gmail.com",
    phone: "+91 99887 76543",
    city: "Bangalore",
    ridingExperience: "intermediate",
    motorcycles: [{ make: "Royal Enfield", model: "Classic 350" }],
    createdAt: "2026-02-25",
  },
  {
    id: "pending-2",
    name: "Meera Nair",
    email: "meera.n@outlook.com",
    phone: "+91 88776 65432",
    city: "Chennai",
    ridingExperience: "beginner",
    motorcycles: [{ make: "Honda", model: "CB300R" }],
    createdAt: "2026-02-26",
  },
  {
    id: "pending-3",
    name: "Rajesh Kumar",
    email: "rajesh.k@yahoo.com",
    phone: "+91 77665 54321",
    city: "Hyderabad",
    ridingExperience: "experienced",
    motorcycles: [{ make: "Kawasaki", model: "Versys 650" }],
    createdAt: "2026-02-27",
  },
];

export const mockAllUsers = [
  {
    id: "admin-1",
    name: "Arjun Mehta",
    email: "admin@t2w.com",
    role: "admin",
    isApproved: true,
    joinDate: "2023-01-01",
  },
  {
    id: "user-1",
    name: "Rohan Kapoor",
    email: "rohan@example.com",
    role: "rider",
    isApproved: true,
    joinDate: "2024-06-15",
  },
  {
    id: "user-2",
    name: "Sneha Kulkarni",
    email: "sneha@example.com",
    role: "rider",
    isApproved: true,
    joinDate: "2024-08-20",
  },
  {
    id: "user-3",
    name: "Vikram Singh",
    email: "vikram@example.com",
    role: "admin",
    isApproved: true,
    joinDate: "2023-03-15",
  },
  {
    id: "user-4",
    name: "Priya Sharma",
    email: "priya@example.com",
    role: "admin",
    isApproved: true,
    joinDate: "2023-02-10",
  },
  {
    id: "user-5",
    name: "Rahul Desai",
    email: "rahul@example.com",
    role: "rider",
    isApproved: true,
    joinDate: "2024-01-08",
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
