<?php

namespace Database\Seeders;

use App\Models\Tag;
use App\Models\Task;
use App\Models\User;
use Illuminate\Database\Seeder;

class TaskSeeder extends Seeder
{
    public function run(): void
    {
        // Create a demo user if not already seeded
        $user = User::firstOrCreate(
            ['email' => 'demo@errorwatch.io'],
            [
                'name' => 'Demo User',
                'password' => bcrypt('password'),
            ]
        );

        // Create 5 tags
        $tagNames = [
            ['name' => 'backend', 'color' => '#3b82f6'],
            ['name' => 'frontend', 'color' => '#ec4899'],
            ['name' => 'bug', 'color' => '#ef4444'],
            ['name' => 'feature', 'color' => '#22c55e'],
            ['name' => 'devops', 'color' => '#f97316'],
        ];

        $tags = collect($tagNames)->map(
            fn (array $data) => Tag::firstOrCreate(['name' => $data['name']], $data)
        );

        // Create 20 tasks and attach random tags
        Task::factory()
            ->count(20)
            ->create(['user_id' => $user->id])
            ->each(function (Task $task) use ($tags): void {
                // Attach 0–3 random tags per task
                $randomTags = $tags->random(rand(0, 3));
                $task->tags()->syncWithoutDetaching($randomTags->pluck('id')->toArray());
            });
    }
}
