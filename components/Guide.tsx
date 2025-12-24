import React from 'react';
import {
    CheckCircle,
    Settings,
    Layers,
    Users,
    GraduationCap,
    Banknote,
    Clock,
    Calendar,
    ArrowRight
} from 'lucide-react';

const Guide: React.FC = () => {
    const steps = [
        {
            id: 1,
            title: "School Profile & Settings",
            description: "Ensure your school's identity is correctly set up. This includes your logo, motto, and contact details which appear on reports and receipts.",
            icon: Settings,
            color: "bg-slate-100 text-slate-600",
            action: "Go to Settings > General",
            tips: [
                "Upload a high-quality logo (PNG format recommended).",
                "Set your brand color to match your school's uniform or identity.",
                "Verify your contact number as it will be used for SMS notifications."
            ]
        },
        {
            id: 2,
            title: "Academic Structure (Classes & Subjects)",
            description: "Define the backbone of your school. You must create classes (e.g., Grade 1) before you can add students.",
            icon: Layers,
            color: "bg-blue-100 text-blue-600",
            action: "Go to Classes (Course Management)",
            tips: [
                "Create Classes first (e.g., Nursery 1, Primary 1, JHS 1).",
                "Then create Subjects (e.g., Mathematics, English).",
                "Assign Subjects to the relevant Classes (e.g., Assign 'Science' to 'Primary 1' through 'JHS 3')."
            ]
        },
        {
            id: 3,
            title: "Staff Onboarding",
            description: "Add your teaching and administrative staff. Teachers need accounts to enter marks and take attendance.",
            icon: GraduationCap,
            color: "bg-purple-100 text-purple-600",
            action: "Go to Teachers",
            tips: [
                "Add teachers and assign them to a specific Class (Class Teacher) if applicable.",
                "Teachers will receive their login credentials to access their own dashboard."
            ]
        },
        {
            id: 4,
            title: "Financial Setup (Fees)",
            description: "Configure your fee structure so you can track payments and generate receipts.",
            icon: Banknote,
            color: "bg-orange-100 text-orange-600",
            action: "Go to Fees",
            tips: [
                "Create Fee Types (e.g., Tuition, Feeding Fee, PTA Dues).",
                "Assign fees to specific classes (e.g., JHS fees might differ from Primary fees).",
                "Once set up, you can start recording payments immediately."
            ]
        },
        {
            id: 5,
            title: "Student Enrollment",
            description: "Register your students into the classes you created.",
            icon: Users,
            color: "bg-emerald-100 text-emerald-600",
            action: "Go to Students",
            tips: [
                "You can add students individually.",
                "Ensure you select the correct Class and Gender for accurate analytics.",
                "Parent phone numbers are crucial for communication features."
            ]
        },
        {
            id: 6,
            title: "Timetable Scheduling",
            description: "Organize the daily learning schedule for each class.",
            icon: Clock,
            color: "bg-pink-100 text-pink-600",
            action: "Go to Timetable",
            tips: [
                "Select a Class and assign subjects to time slots.",
                "This helps teachers know where they need to be and when."
            ]
        },
        {
            id: 7,
            title: "Daily Operations",
            description: "You are now ready for day-to-day management!",
            icon: Calendar,
            color: "bg-indigo-100 text-indigo-600",
            action: "Attendance, Exams & Reports",
            tips: [
                "Mark Attendance daily.",
                "Record Exam scores at the end of the term.",
                "Generate Terminal Reports automatically."
            ]
        }
    ];

    return (
        <div className="bg-white py-24 sm:py-32">
            <div className="mx-auto max-w-7xl px-6 lg:px-8">
                <div className="mx-auto max-w-2xl lg:mx-0 mb-16">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">School Setup Manual</h2>
                    <p className="mt-6 text-lg leading-8 text-slate-600">
                        Welcome to Base16! Follow this step-by-step guide to get your school up and running efficiently.
                        We recommend completing these steps in the order presented below.
                    </p>
                </div>

                <div className="space-y-12">
                    {steps.map((step, index) => (
                        <div key={step.id} className="relative flex gap-x-8 rounded-2xl bg-slate-50 p-8 hover:bg-white hover:shadow-lg transition-all border border-slate-100">
                            <div className={`absolute -left-4 -top-4 flex h-10 w-10 items-center justify-center rounded-full font-bold text-white shadow-lg ${index === 0 ? 'bg-primary-600' : 'bg-slate-400'}`}>
                                {step.id}
                            </div>

                            <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-xl ${step.color}`}>
                                <step.icon className="h-8 w-8" aria-hidden="true" />
                            </div>

                            <div className="flex-1">
                                <h3 className="text-xl font-bold leading-7 text-slate-900 flex items-center gap-2">
                                    {step.title}
                                    {index === 0 && <span className="inline-flex items-center rounded-md bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10">Start Here</span>}
                                </h3>
                                <p className="mt-2 text-base leading-7 text-slate-600">{step.description}</p>

                                <div className="mt-4 bg-white rounded-lg border border-slate-200 p-4">
                                    <h4 className="text-sm font-bold text-slate-800 mb-2 flex items-center gap-2">
                                        <CheckCircle className="h-4 w-4 text-green-500" /> Pro Tips:
                                    </h4>
                                    <ul className="list-disc list-inside text-sm text-slate-600 space-y-1 ml-1">
                                        {step.tips.map((tip, i) => (
                                            <li key={i}>{tip}</li>
                                        ))}
                                    </ul>
                                </div>

                                <div className="mt-4 flex items-center gap-2 text-sm font-medium text-primary-600">
                                    <ArrowRight className="h-4 w-4" /> {step.action}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mt-16 flex justify-center">
                    <div className="rounded-2xl bg-primary-900 p-8 text-center text-white max-w-3xl">
                        <h3 className="text-2xl font-bold mb-4">Need extra help?</h3>
                        <p className="mb-6 text-primary-100">
                            Our support team is available to assist you with the setup process.
                            If you get stuck at any point, don't hesitate to reach out.
                        </p>
                        <a href="/contact" className="inline-block rounded-lg bg-white px-6 py-3 text-sm font-bold text-primary-900 shadow-sm hover:bg-primary-50 transition-colors">
                            Contact Support
                        </a>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Guide;
