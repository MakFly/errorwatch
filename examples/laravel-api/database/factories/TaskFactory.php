<?php

namespace Database\Factories;

use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use App\Models\User;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<\App\Models\Task>
 */
class TaskFactory extends Factory
{
    public function definition(): array
    {
        return [
            'user_id' => User::factory(),
            'title' => fake()->sentence(nbWords: fake()->numberBetween(3, 8), variableNbWords: false),
            'description' => fake()->optional(0.7)->paragraph(),
            'status' => fake()->randomElement(TaskStatus::cases())->value,
            'priority' => fake()->randomElement(TaskPriority::cases())->value,
            'due_date' => fake()->optional(0.6)->dateTimeBetween('now', '+3 months')?->format('Y-m-d'),
        ];
    }

    public function pending(): static
    {
        return $this->state(['status' => TaskStatus::Pending->value]);
    }

    public function inProgress(): static
    {
        return $this->state(['status' => TaskStatus::InProgress->value]);
    }

    public function done(): static
    {
        return $this->state(['status' => TaskStatus::Done->value]);
    }

    public function highPriority(): static
    {
        return $this->state(['priority' => TaskPriority::High->value]);
    }
}
