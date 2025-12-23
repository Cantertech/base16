import React from 'react';
import { CheckCircle, Users, Globe, Award } from 'lucide-react';

const About: React.FC = () => {
    return (
        <div className="bg-white">
            {/* Hero Section */}
            <div className="relative bg-slate-900 py-24 sm:py-32">
                <div className="absolute inset-0 overflow-hidden">
                    <img
                        src="https://images.unsplash.com/photo-1522071820081-009f0129c71c?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=2850&q=80"
                        alt="Team working together"
                        className="h-full w-full object-cover object-center opacity-20"
                    />
                </div>
                <div className="relative mx-auto max-w-7xl px-6 lg:px-8">
                    <div className="mx-auto max-w-2xl lg:mx-0">
                        <h2 className="text-4xl font-bold tracking-tight text-white sm:text-6xl">About Base16</h2>
                        <p className="mt-6 text-lg leading-8 text-slate-300">
                            Empowering educational institutions with intelligent, seamless, and futuristic management solutions. A proud product of SixZones.
                        </p>
                    </div>
                </div>
            </div>

            {/* Mission Section */}
            <div className="mx-auto max-w-7xl px-6 py-24 sm:py-32 lg:px-8">
                <div className="mx-auto max-w-2xl lg:mx-0">
                    <h2 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">Our Mission</h2>
                    <p className="mt-6 text-lg leading-8 text-slate-600">
                        At Base16, we believe that education is the cornerstone of progress. Our mission is to strip away the administrative burden from educators, allowing them to focus on what truly matters: teaching and inspiring the next generation. We leverage cutting-edge technology to create a school management ecosystem that is intuitive, powerful, and accessible.
                    </p>
                </div>
                <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
                    <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
                        <div className="flex flex-col">
                            <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-slate-900">
                                <Users className="h-5 w-5 flex-none text-blue-600" aria-hidden="true" />
                                Student-Centric
                            </dt>
                            <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600">
                                <p className="flex-auto">Everything we build is designed to improve the student experience, from smoother admissions to better tracking of academic progress.</p>
                            </dd>
                        </div>
                        <div className="flex flex-col">
                            <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-slate-900">
                                <Globe className="h-5 w-5 flex-none text-blue-600" aria-hidden="true" />
                                Global Standards
                            </dt>
                            <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600">
                                <p className="flex-auto">We bring world-class software standards to local educational institutions, ensuring reliability, security, and scalability.</p>
                            </dd>
                        </div>
                        <div className="flex flex-col">
                            <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-slate-900">
                                <Award className="h-5 w-5 flex-none text-blue-600" aria-hidden="true" />
                                Excellence Driven
                            </dt>
                            <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-600">
                                <p className="flex-auto">As a SixZones product, Base16 inherits a legacy of digital excellence and innovation.</p>
                            </dd>
                        </div>
                    </dl>
                </div>
            </div>

            {/* Stats */}
            <div className="bg-slate-50 py-24 sm:py-32">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                    <dl className="grid grid-cols-1 gap-x-8 gap-y-16 text-center lg:grid-cols-3">
                        <div className="mx-auto flex max-w-xs flex-col gap-y-4">
                            <dt className="text-base leading-7 text-slate-600">Schools Trusted</dt>
                            <dd className="order-first text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">50+</dd>
                        </div>
                        <div className="mx-auto flex max-w-xs flex-col gap-y-4">
                            <dt className="text-base leading-7 text-slate-600">Students Managed</dt>
                            <dd className="order-first text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">10k+</dd>
                        </div>
                        <div className="mx-auto flex max-w-xs flex-col gap-y-4">
                            <dt className="text-base leading-7 text-slate-600">Uptime</dt>
                            <dd className="order-first text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">99.9%</dd>
                        </div>
                    </dl>
                </div>
            </div>
        </div>
    );
};

export default About;
