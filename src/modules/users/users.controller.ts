import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
    constructor(private readonly usersService: UsersService) {}

    @Post()
    createUser(@Body() body: any) {
        return this.usersService.createUser(body);
    }

    @Get(':id')
    getUser(@Param('id') id: string) {
        return this.usersService.getUser(id);
    }

    @Patch(':id')
    updateUser(@Param('id') id: string, @Body() body: any) {
        return this.usersService.updateUser(id, body);
    }

    @Get('match/:userId')
    matchUsers(@Param('userId') userId: string) {
        return this.usersService.matchUsers(userId);
    }
}
