<?php

use App\Http\Controllers\Api\V1\AuthController;
use App\Http\Controllers\Api\V1\TagController;
use App\Http\Controllers\Api\V1\TaskController;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Route;

Route::prefix('v1')->group(function (): void {
    // -----------------------------------------------------------------------
    // ErrorWatch test routes (public — demo purposes only)
    // -----------------------------------------------------------------------
    Route::get('test/error', function (): never {
        throw new \RuntimeException('Test error from Laravel API — ErrorWatch is working!');
    });

    Route::get('test/warning', function () {
        Log::warning('Test warning from Laravel API', ['source' => 'errorwatch-demo']);

        return response()->json(['message' => 'Warning logged and sent to ErrorWatch.']);
    });

    Route::get('test/divide-by-zero', function () {
        $result = 10 / 0;  // @phpstan-ignore-line

        return response()->json(['result' => $result]);
    });

    // -----------------------------------------------------------------------
    // Public auth routes
    // -----------------------------------------------------------------------
    Route::post('register', [AuthController::class, 'register']);
    Route::post('login', [AuthController::class, 'login']);

    // -----------------------------------------------------------------------
    // Protected routes (Sanctum token auth)
    // -----------------------------------------------------------------------
    Route::middleware('auth:sanctum')->group(function (): void {
        Route::post('logout', [AuthController::class, 'logout']);
        Route::get('me', [AuthController::class, 'me']);

        // Tasks
        Route::apiResource('tasks', TaskController::class);
        Route::post('tasks/{task}/tags', [TaskController::class, 'attachTags']);
        Route::delete('tasks/{task}/tags', [TaskController::class, 'detachTags']);

        // Tags
        Route::apiResource('tags', TagController::class);
    });
});
