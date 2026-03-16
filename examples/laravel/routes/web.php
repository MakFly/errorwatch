<?php

use App\Http\Controllers\TestController;
use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| ErrorWatch Laravel Example Routes
|--------------------------------------------------------------------------
|
| These routes demonstrate the different ErrorWatch SDK capture mechanisms.
| ErrorWatchMiddleware is automatically registered for the 'web' group by
| the ErrorWatchServiceProvider on Laravel 11+.
|
*/

Route::get('/', [TestController::class, 'index']);

// Throws a RuntimeException — captured automatically by ErrorWatchExceptionHandler
Route::get('/error', [TestController::class, 'triggerError']);

// Sends a manual message via ErrorWatch::captureMessage()
Route::get('/message', [TestController::class, 'sendMessage']);

// Adds manual breadcrumbs then throws — captured with the full breadcrumb trail
Route::get('/breadcrumb', [TestController::class, 'triggerBreadcrumb']);
