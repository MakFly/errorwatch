<?php

declare(strict_types=1);

namespace App\Http\Controllers\Api\V1;

use App\Enums\TaskPriority;
use App\Enums\TaskStatus;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreTaskRequest;
use App\Http\Requests\UpdateTaskRequest;
use App\Http\Resources\TaskCollection;
use App\Http\Resources\TaskResource;
use App\Models\Task;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class TaskController extends Controller
{
    public function index(Request $request): TaskCollection
    {
        $query = Task::with('tags')
            ->forUser($request->user()->id)
            ->orderBy('created_at', 'desc');

        if ($request->filled('status')) {
            $status = TaskStatus::tryFrom($request->string('status')->toString());
            if ($status !== null) {
                $query->byStatus($status);
            }
        }

        if ($request->filled('priority')) {
            $priority = TaskPriority::tryFrom($request->string('priority')->toString());
            if ($priority !== null) {
                $query->byPriority($priority);
            }
        }

        return new TaskCollection($query->paginate(15));
    }

    public function store(StoreTaskRequest $request): TaskResource
    {
        $task = Task::create([
            ...$request->validated(),
            'user_id' => $request->user()->id,
        ]);

        $task->load('tags');

        return new TaskResource($task);
    }

    public function show(Request $request, Task $task): TaskResource|JsonResponse
    {
        if ($task->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Task not found.'], 404);
        }

        $task->load('tags');

        return new TaskResource($task);
    }

    public function update(UpdateTaskRequest $request, Task $task): TaskResource|JsonResponse
    {
        if ($task->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Task not found.'], 404);
        }

        $task->update($request->validated());
        $task->load('tags');

        return new TaskResource($task);
    }

    public function destroy(Request $request, Task $task): JsonResponse
    {
        if ($task->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Task not found.'], 404);
        }

        $task->delete();

        return response()->json(['message' => 'Task deleted successfully.']);
    }

    public function attachTags(Request $request, Task $task): TaskResource|JsonResponse
    {
        if ($task->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Task not found.'], 404);
        }

        $request->validate([
            'tag_ids' => ['required', 'array'],
            'tag_ids.*' => ['integer', 'exists:tags,id'],
        ]);

        $task->tags()->syncWithoutDetaching($request->input('tag_ids'));
        $task->load('tags');

        return new TaskResource($task);
    }

    public function detachTags(Request $request, Task $task): TaskResource|JsonResponse
    {
        if ($task->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Task not found.'], 404);
        }

        $request->validate([
            'tag_ids' => ['required', 'array'],
            'tag_ids.*' => ['integer', 'exists:tags,id'],
        ]);

        $task->tags()->detach($request->input('tag_ids'));
        $task->load('tags');

        return new TaskResource($task);
    }
}
